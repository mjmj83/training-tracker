import { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import bcryptjs from "bcryptjs";
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
  const proto = req.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(proto) ? proto[0] : proto) || req.protocol || "http";
  const origin = `${protocol}://${host}`;
  console.log(`[rpConfig] host=${host} rpID=${rpID} origin=${origin}`);
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

  // POST /api/auth/login/options — with or without email (discoverable credentials)
  app.post("/api/auth/login/options", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      const { rpID } = getRpConfig(req);

      if (email) {
        // Email provided: restrict to that user's credentials
        const user = storage.getUserByEmail(email);
        if (!user) return res.status(404).json({ error: "Gebruiker niet gevonden" });
        const userCredentials = storage.getCredentialsByUserId(user.id);
        if (userCredentials.length === 0) {
          return res.status(400).json({ error: "Geen passkey geregistreerd. Registreer eerst een passkey." });
        }
        const options = await generateAuthenticationOptions({
          rpID,
          allowCredentials: userCredentials.map((c) => ({
            id: c.credentialId,
            transports: c.transports ? (JSON.parse(c.transports) as AuthenticatorTransportFuture[]) : undefined,
          })),
          userVerification: "preferred",
        });
        const sessionId = crypto.randomBytes(32).toString("hex");
        storage.createSession(sessionId, user.id, options.challenge);
        res.json({ options, sessionId });
      } else {
        // No email: discoverable credential flow — browser picks the passkey
        const options = await generateAuthenticationOptions({
          rpID,
          userVerification: "preferred",
          // Empty allowCredentials = browser shows all available passkeys for this rpID
        });
        // Store challenge in a temporary session (userId=0 placeholder, will be resolved on verify)
        const sessionId = crypto.randomBytes(32).toString("hex");
        // Create a temp session — we use userId of first user as placeholder (will be overridden)
        const anyUser = storage.getUsers()[0];
        if (!anyUser) return res.status(400).json({ error: "Geen gebruikers gevonden" });
        storage.createSession(sessionId, anyUser.id, options.challenge);
        res.json({ options, sessionId });
      }
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
      if (!credential) {
        console.error("Unknown credential ID:", response.id);
        const allCreds = storage.getUsers().flatMap(u => storage.getCredentialsByUserId(u.id));
        console.error("Known credentials:", allCreds.map(c => c.credentialId));
        return res.status(400).json({ error: "Onbekende passkey. Mogelijk is je passkey verlopen of verwijderd. Log in met PIN en registreer opnieuw." });
      }

      const { rpID, origin } = getRpConfig(req);
      console.log("Auth verify - rpID:", rpID, "origin:", origin);

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
      // Use credential's userId (handles discoverable credential flow where session userId was a placeholder)
      const authenticatedUserId = credential.userId;
      storage.deleteSession(sessionId);
      const newSessionId = crypto.randomBytes(32).toString("hex");
      storage.createSession(newSessionId, authenticatedUserId);

      const user = storage.getUserById(authenticatedUserId);
      res.json({ verified: true, sessionId: newSessionId, user });
    } catch (e: any) {
      console.error("login/verify error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/auth/pin-login — fallback for iframes where WebAuthn is blocked
  app.post("/api/auth/pin-login", (req: Request, res: Response) => {
    try {
      const { email, pin } = req.body;
      if (!email || !pin) return res.status(400).json({ error: "Email en PIN zijn vereist" });

      const user = storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ error: "Gebruiker niet gevonden" });
      if (!user.pinHash) return res.status(400).json({ error: "Geen PIN ingesteld. Neem contact op met je trainer." });

      if (!bcryptjs.compareSync(pin, user.pinHash)) {
        return res.status(401).json({ error: "Onjuiste PIN" });
      }

      const sessionId = crypto.randomBytes(32).toString("hex");
      storage.createSession(sessionId, user.id);
      res.json({ verified: true, sessionId, user });
    } catch (e: any) {
      console.error("pin-login error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/auth/set-pin — set/change PIN for a user (requires auth)
  app.post("/api/auth/set-pin", (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Not authenticated" });
      const session = storage.getSession(token);
      if (!session) return res.status(401).json({ error: "Invalid session" });

      const { pin, userId } = req.body;
      if (!pin || pin.length < 4) return res.status(400).json({ error: "PIN moet minimaal 4 tekens zijn" });

      // Trainers can set PIN for any user, clients only for themselves
      const targetId = session.user.role === "trainer" && userId ? userId : session.user.id;
      const hash = bcryptjs.hashSync(pin, 10);
      storage.updateUser(targetId, { pinHash: hash });
      res.json({ ok: true });
    } catch (e: any) {
      console.error("set-pin error:", e);
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
