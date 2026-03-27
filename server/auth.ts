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
  // POST /api/auth/register — register a new account with email + PIN (whitelist required)
  app.post("/api/auth/register", (req: Request, res: Response) => {
    try {
      const { email, pin } = req.body;
      if (!email || !pin) return res.status(400).json({ error: "E-mail en PIN zijn vereist" });
      if (pin.length < 4) return res.status(400).json({ error: "PIN moet minimaal 4 tekens zijn" });

      // Check whitelist
      const whitelisted = storage.getWhitelistedEmail(email);
      if (!whitelisted) {
        return res.status(403).json({ error: "Dit e-mailadres is niet goedgekeurd. Neem contact op met de admin." });
      }

      // Check if user already exists
      const existing = storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Dit e-mailadres is al geregistreerd. Gebruik inloggen." });
      }

      const pinHash = bcryptjs.hashSync(pin, 10);
      const user = storage.createUser({
        email: email.toLowerCase(),
        displayName: email.split("@")[0],
        role: whitelisted.role,
        pinHash,
      });

      const sessionId = crypto.randomBytes(32).toString("hex");
      storage.createSession(sessionId, user.id);

      res.json({ verified: true, sessionId, user });
    } catch (e: any) {
      console.error("register error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/auth/register/options — passkey registration (requires auth)
  app.post("/api/auth/register/options", async (req: Request, res: Response) => {
    try {
      // Must be authenticated to register a passkey
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Je moet ingelogd zijn om een passkey te registreren" });
      const session = storage.getSession(token);
      if (!session) return res.status(401).json({ error: "Ongeldige sessie" });

      const user = session.user;

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
      const { sessionId, response, name } = req.body;
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
        name: name || null,
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

  // POST /api/auth/create-client-user — trainer creates a login for a client
  app.post("/api/auth/create-client-user", (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Not authenticated" });
      const session = storage.getSession(token);
      if (!session || session.user.role !== "trainer") {
        return res.status(403).json({ error: "Alleen trainers kunnen klant-accounts aanmaken" });
      }

      const { email, pin, clientId, displayName } = req.body;
      if (!email || !pin || !clientId) {
        return res.status(400).json({ error: "Email, PIN en klant zijn vereist" });
      }
      if (pin.length < 4) {
        return res.status(400).json({ error: "PIN moet minimaal 4 tekens zijn" });
      }

      // Check if email is already taken
      const existing = storage.getUserByEmail(email);
      if (existing) {
        // If account exists but has no pin, update it
        if (!existing.pinHash) {
          const pinHash = bcryptjs.hashSync(pin, 10);
          storage.updateUser(existing.id, { pinHash, clientId, role: "client" });
          return res.json({ ok: true, user: { id: existing.id, email: existing.email, displayName: existing.displayName, role: "client", clientId } });
        }
        return res.status(400).json({ error: "Dit e-mailadres is al in gebruik" });
      }

      // Verify the client belongs to this trainer
      const client = storage.getClient(clientId);
      if (!client || client.ownerId !== session.user.id) {
        return res.status(403).json({ error: "Deze klant is niet van jou" });
      }

      const pinHash = bcryptjs.hashSync(pin, 10);
      const user = storage.createUser({
        email,
        displayName: displayName || client.name,
        role: "client",
        clientId,
        pinHash,
      });

      res.json({ ok: true, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, clientId: user.clientId } });
    } catch (e: any) {
      console.error("create-client-user error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/auth/client-users — list client users for a trainer
  app.get("/api/auth/client-users", (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Not authenticated" });
      const session = storage.getSession(token);
      if (!session || session.user.role !== "trainer") {
        return res.status(403).json({ error: "Alleen trainers" });
      }

      const allUsers = storage.getUsers().filter(u => u.role === "client");
      // Only return client users whose clientId belongs to this trainer
      const trainerClients = storage.getClientsByOwner(session.user.id);
      const trainerClientIds = new Set(trainerClients.map(c => c.id));
      const clientUsers = allUsers.filter(u => u.clientId && trainerClientIds.has(u.clientId));

      res.json(clientUsers.map(u => ({ id: u.id, email: u.email, displayName: u.displayName, role: u.role, clientId: u.clientId })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/auth/client-users/:id — trainer deletes a client user
  app.delete("/api/auth/client-users/:id", (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Not authenticated" });
      const session = storage.getSession(token);
      if (!session || session.user.role !== "trainer") {
        return res.status(403).json({ error: "Alleen trainers" });
      }
      // TODO: delete user, their credentials, and sessions
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ============= ADMIN =============
  const ADMIN_EMAIL = "mariusjansen@gmail.com";

  function isAdmin(req: Request): boolean {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return false;
    const session = storage.getSession(token);
    return session?.user?.email === ADMIN_EMAIL;
  }

  // GET /api/admin/users — all users with their linked clients and trainers
  app.get("/api/admin/users", (req: Request, res: Response) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "Geen toegang" });

    const allUsers = storage.getUsers();
    const allClients = storage.getClients();

    const result = allUsers.map(u => {
      const linkedClient = u.clientId ? allClients.find(c => c.id === u.clientId) : null;
      // For client users, find the trainer who owns their linked client
      let trainerEmail: string | null = null;
      if (u.role === "client" && linkedClient?.ownerId) {
        const trainer = allUsers.find(t => t.id === linkedClient.ownerId);
        trainerEmail = trainer?.email || null;
      }
      // For trainers, count their clients
      const ownedClients = u.role === "trainer" ? allClients.filter(c => c.ownerId === u.id) : [];

      return {
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        clientName: linkedClient?.name || null,
        trainerEmail,
        ownedClientCount: ownedClients.length,
        ownedClientNames: ownedClients.map(c => c.name),
      };
    });

    res.json(result);
  });

  // DELETE /api/admin/users/:id — admin deletes any user
  app.delete("/api/admin/users/:id", (req: Request, res: Response) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "Geen toegang" });
    const userId = parseInt(req.params.id);
    // Don't allow deleting yourself
    const token = req.headers.authorization?.replace("Bearer ", "");
    const session = storage.getSession(token!);
    if (session?.user?.id === userId) {
      return res.status(400).json({ error: "Je kunt jezelf niet verwijderen" });
    }
    storage.deleteUser(userId);
    res.json({ ok: true });
  });

  // ============= ADMIN WHITELIST =============
  app.get("/api/admin/whitelist", (req: Request, res: Response) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "Geen toegang" });
    res.json(storage.getWhitelistedEmails());
  });

  app.post("/api/admin/whitelist", (req: Request, res: Response) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "Geen toegang" });
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: "E-mail is vereist" });
    try {
      const entry = storage.addWhitelistedEmail(email, role || "trainer");
      res.json(entry);
    } catch (e: any) {
      if (e.message?.includes("UNIQUE")) {
        return res.status(400).json({ error: "Dit e-mailadres staat al op de whitelist" });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/admin/whitelist/:id", (req: Request, res: Response) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "Geen toegang" });
    storage.removeWhitelistedEmail(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // GET /api/auth/passkeys — list passkeys for current user
  app.get("/api/auth/passkeys", (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const session = storage.getSession(token);
    if (!session) return res.status(401).json({ error: "Invalid session" });

    const creds = storage.getCredentialsByUserId(session.user.id);
    res.json(creds.map(c => ({
      id: c.id,
      name: c.name || "Naamloos",
      createdAt: c.createdAt,
    })));
  });

  // DELETE /api/auth/passkeys/:id — delete a passkey
  app.delete("/api/auth/passkeys/:id", (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const session = storage.getSession(token);
    if (!session) return res.status(401).json({ error: "Invalid session" });

    const id = parseInt(req.params.id);
    const deleted = storage.deleteCredential(id, session.user.id);
    if (!deleted) return res.status(404).json({ error: "Passkey niet gevonden" });
    res.json({ ok: true });
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

    // Read-only enforcement for client users
    if (session.user.role === "client" && req.method !== "GET") {
      // Allow logout
      if (req.path === "/api/auth/logout") return next();
      return res.status(403).json({ error: "Alleen-lezen toegang. Neem contact op met je trainer." });
    }

    next();
  };
}
