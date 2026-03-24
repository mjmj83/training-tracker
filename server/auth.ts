import { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { SqliteStorage } from "./storage";

function getRpConfig(req: Request) {
  const host = req.headers.host || "localhost:5000";
  const rpID = host.split(":")[0];
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const origin = `${protocol}://${host}`;
  return { rpName: "Training Tracker", rpID, origin };
}

export function registerAuthRoutes(app: Express, storage: SqliteStorage) {
  // POST /api/auth/register/options
  app.post("/api/auth/register/options", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      let user = storage.getUserByEmail(email);
      if (!user) {
        user = storage.createUser({ email, displayName: email.split("@")[0], role: "trainer" });
      }

      const existingCredentials = storage.getCredentialsByUserId(user.id);
      const { rpName, rpID } = getRpConfig(req);

      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: new TextEncoder().encode(String(user.id)),
        userName: user.email,
        userDisplayName: user.displayName,
        attestationType: "none",
        excludeCredentials: existingCredentials.map((c) => ({
          id: c.credentialId,
          transports: c.transports
            ? (JSON.parse(c.transports) as AuthenticatorTransportFuture[])
            : undefined,
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });

      const sessionId = crypto.randomBytes(32).toString("hex");
      storage.createSession(sessionId, user.id, options.challenge);

      res.json({ options, sessionId });
    } catch (e: any) {
      console.error("register/options error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/auth/register/verify
  app.post("/api/auth/register/verify", async (req: Request, res: Response) => {
    try {
      const { sessionId, response } = req.body;
      if (!sessionId || !response) return res.status(400).json({ error: "Missing sessionId or response" });

      const session = storage.getSession(sessionId);
      if (!session || !session.challenge) return res.status(400).json({ error: "Invalid or expired session" });

      const { rpID, origin } = getRpConfig(req);

      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: session.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: "Verification failed" });
      }

      const { credential } = verification.registrationInfo;

      storage.createCredential({
        userId: session.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: response.response.transports
          ? JSON.stringify(response.response.transports)
          : null,
        createdAt: new Date().toISOString(),
      });

      // Delete temp session, create authenticated session
      storage.deleteSession(sessionId);
      const newSessionId = crypto.randomBytes(32).toString("hex");
      storage.createSession(newSessionId, session.userId);

      const user = storage.getUserById(session.userId);
      res.json({ verified: true, sessionId: newSessionId, user });
    } catch (e: any) {
      console.error("register/verify error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/auth/login/options
  app.post("/api/auth/login/options", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const user = storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ error: "Gebruiker niet gevonden" });

      const userCredentials = storage.getCredentialsByUserId(user.id);
      if (userCredentials.length === 0) {
        return res.status(400).json({ error: "Geen passkey geregistreerd. Registreer eerst een passkey." });
      }

      const { rpID } = getRpConfig(req);

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: userCredentials.map((c) => ({
          id: c.credentialId,
          transports: c.transports
            ? (JSON.parse(c.transports) as AuthenticatorTransportFuture[])
            : undefined,
        })),
        userVerification: "preferred",
      });

      const sessionId = crypto.randomBytes(32).toString("hex");
      storage.createSession(sessionId, user.id, options.challenge);

      res.json({ options, sessionId });
    } catch (e: any) {
      console.error("login/options error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/auth/login/verify
  app.post("/api/auth/login/verify", async (req: Request, res: Response) => {
    try {
      const { sessionId, response } = req.body;
      if (!sessionId || !response) return res.status(400).json({ error: "Missing sessionId or response" });

      const session = storage.getSession(sessionId);
      if (!session || !session.challenge) return res.status(400).json({ error: "Invalid or expired session" });

      const credential = storage.getCredentialByCredentialId(response.id);
      if (!credential) return res.status(400).json({ error: "Unknown credential" });

      const { rpID, origin } = getRpConfig(req);

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: session.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credential.credentialId,
          publicKey: Buffer.from(credential.publicKey, "base64url"),
          counter: credential.counter,
          transports: credential.transports
            ? (JSON.parse(credential.transports) as AuthenticatorTransportFuture[])
            : undefined,
        },
      });

      if (!verification.verified) {
        return res.status(400).json({ error: "Verification failed" });
      }

      // Update counter
      storage.updateCredentialCounter(credential.credentialId, verification.authenticationInfo.newCounter);

      // Delete temp session, create authenticated session
      storage.deleteSession(sessionId);
      const newSessionId = crypto.randomBytes(32).toString("hex");
      storage.createSession(newSessionId, session.userId);

      const user = storage.getUserById(session.userId);
      res.json({ verified: true, sessionId: newSessionId, user });
    } catch (e: any) {
      console.error("login/verify error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/auth/me
  app.get("/api/auth/me", (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const session = storage.getSession(token);
    if (!session) return res.status(401).json({ error: "Invalid session" });

    if (new Date(session.expiresAt) < new Date()) {
      storage.deleteSession(token);
      return res.status(401).json({ error: "Session expired" });
    }

    res.json({ user: session.user });
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      storage.deleteSession(token);
    }
    res.json({ ok: true });
  });
}

export function authMiddleware(storage: SqliteStorage) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip auth for /api/auth/* routes and non-API routes
    if (!req.path.startsWith("/api/") || req.path.startsWith("/api/auth/")) {
      return next();
    }
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const session = storage.getSession(token);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    if (new Date(session.expiresAt) < new Date()) {
      storage.deleteSession(token);
      return res.status(401).json({ error: "Session expired" });
    }
    (req as any).user = session.user;
    (req as any).sessionId = token;
    next();
  };
}
