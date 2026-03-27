import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, like } from "drizzle-orm";
import bcryptjs from "bcryptjs";
import fs from "fs";
import path from "path";
import {
  clients, type Client, type InsertClient,
  noteTabs, type NoteTab, type InsertNoteTab,
  abcMeasurements, type AbcMeasurement, type InsertAbcMeasurement,
  months, type Month, type InsertMonth,
  trainingDays, type TrainingDay, type InsertTrainingDay,
  exercises, type Exercise, type InsertExercise,
  weekDates, type WeekDate, type InsertWeekDate,
  weightLogs, type WeightLog, type InsertWeightLog,
  exerciseLibrary, type ExerciseLibrary,
  snapshots, type Snapshot, type InsertSnapshot,
  users, type User,
  credentials, type Credential,
  sessions, type Session,
  emailWhitelist, type EmailWhitelist,
} from "@shared/schema";

const dbPath = process.env.DATABASE_PATH || "training.db";

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (dbDir !== "." && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbExisted = fs.existsSync(dbPath);
const sqlite = new Database(dbPath);
console.log(`Database: ${dbPath} (existed: ${dbExisted}, size: ${dbExisted ? fs.statSync(dbPath).size : 0} bytes)`);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);

// Create tables + migrations
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS months (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    label TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    week_count INTEGER NOT NULL DEFAULT 4,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS training_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id INTEGER NOT NULL REFERENCES months(id),
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    training_day_id INTEGER NOT NULL REFERENCES training_days(id),
    name TEXT NOT NULL,
    sets INTEGER NOT NULL DEFAULT 3,
    goal_reps INTEGER NOT NULL DEFAULT 10,
    tempo TEXT DEFAULT '',
    rest INTEGER DEFAULT 60,
    notes TEXT DEFAULT '',
    superset_group_id INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS week_dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id INTEGER NOT NULL REFERENCES months(id),
    training_day_id INTEGER NOT NULL REFERENCES training_days(id),
    week_number INTEGER NOT NULL,
    date TEXT
  );
  CREATE TABLE IF NOT EXISTS weight_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    week_number INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    weight REAL,
    reps INTEGER,
    notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS exercise_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id INTEGER NOT NULL REFERENCES months(id),
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Migrations for existing DBs
try { sqlite.exec("ALTER TABLE months ADD COLUMN week_count INTEGER NOT NULL DEFAULT 4"); } catch {}
try { sqlite.exec("ALTER TABLE exercises ADD COLUMN superset_group_id INTEGER"); } catch {}
try { sqlite.exec("ALTER TABLE exercises ADD COLUMN notes TEXT DEFAULT ''"); } catch {}
try { sqlite.exec("ALTER TABLE weight_logs ADD COLUMN notes TEXT DEFAULT ''"); } catch {}
try { sqlite.exec("ALTER TABLE clients ADD COLUMN notes TEXT DEFAULT ''"); } catch {}
try { sqlite.exec("ALTER TABLE exercise_library ADD COLUMN active INTEGER NOT NULL DEFAULT 1"); } catch {}
try { sqlite.exec("ALTER TABLE clients ADD COLUMN gender TEXT NOT NULL DEFAULT 'male'"); } catch {}
try { sqlite.exec("ALTER TABLE clients ADD COLUMN bf_reminder_enabled INTEGER NOT NULL DEFAULT 1"); } catch {}
try { sqlite.exec("ALTER TABLE months ADD COLUMN start_date TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE exercises ADD COLUMN rir TEXT DEFAULT ''"); } catch {}
try { sqlite.exec("ALTER TABLE exercises ADD COLUMN weight_type TEXT NOT NULL DEFAULT 'weighted'"); } catch {}
try { sqlite.exec("ALTER TABLE exercise_library ADD COLUMN weight_type TEXT NOT NULL DEFAULT 'weighted'"); } catch {}

// Multi-tenant migrations
try { sqlite.exec("ALTER TABLE clients ADD COLUMN owner_id INTEGER"); } catch {}
try { sqlite.exec("ALTER TABLE exercise_library ADD COLUMN owner_id INTEGER"); } catch {}
try { sqlite.exec("DROP INDEX IF EXISTS exercise_library_name_unique"); } catch {}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS abc_measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    date TEXT NOT NULL,
    gender TEXT NOT NULL,
    weight_kg REAL,
    height_cm REAL NOT NULL DEFAULT 170,
    neck_cm REAL NOT NULL DEFAULT 38,
    abdomen_cm REAL NOT NULL,
    hip_cm REAL,
    body_fat_pct REAL NOT NULL
  );
`);
// Migrations for abc_measurements new columns
try { sqlite.exec("ALTER TABLE abc_measurements ADD COLUMN height_cm REAL NOT NULL DEFAULT 170"); } catch {}
try { sqlite.exec("ALTER TABLE abc_measurements ADD COLUMN neck_cm REAL NOT NULL DEFAULT 38"); } catch {}
try { sqlite.exec("ALTER TABLE abc_measurements ADD COLUMN hip_cm REAL"); } catch {}
// Make weight_kg nullable (SQLite doesn't support ALTER COLUMN, old rows keep their value)
// Old measurements that lack the new fields are kept as-is; new ones use the full formula.

// Auth tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client',
    client_id INTEGER REFERENCES clients(id)
  );
  CREATE TABLE IF NOT EXISTS credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    challenge TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
`);

// Note tabs table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS note_tabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    name TEXT NOT NULL,
    content TEXT DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );
`);

// Email whitelist table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS email_whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'trainer',
    created_at TEXT NOT NULL
  );
`);

// Migration: add pin_hash column
try { sqlite.exec("ALTER TABLE users ADD COLUMN pin_hash TEXT"); } catch {}
// Migration: add name column to credentials
try { sqlite.exec("ALTER TABLE credentials ADD COLUMN name TEXT"); } catch {}

// Seed default trainer user
{
  const userCount = db.select().from(users).all().length;
  if (userCount === 0) {
    const defaultPin = bcryptjs.hashSync("%jwhealth%_09", 10);
    db.insert(users).values({ email: "test@test.com", displayName: "Trainer", role: "trainer", pinHash: defaultPin }).run();
  } else {
    // Migrate existing trainer account to new credentials
    const oldTrainer = db.select().from(users).all().find(u => u.email === "trainer@training.app");
    if (oldTrainer) {
      const newPin = bcryptjs.hashSync("%jwhealth%_09", 10);
      db.update(users).set({ email: "test@test.com", pinHash: newPin }).where(eq(users.id, oldTrainer.id)).run();
    }
    // Set default PIN for users that don't have one
    const usersWithoutPin = db.select().from(users).all().filter(u => !u.pinHash);
    if (usersWithoutPin.length > 0) {
      const defaultPin = bcryptjs.hashSync("%jwhealth%_09", 10);
      for (const u of usersWithoutPin) {
        db.update(users).set({ pinHash: defaultPin }).where(eq(users.id, u.id)).run();
      }
    }
  }
}
// Assign unowned clients and exercise library entries to the first trainer
{
  const firstTrainer = db.select().from(users).all().find(u => u.role === "trainer");
  if (firstTrainer) {
    const unownedClients = db.select().from(clients).all().filter(c => !c.ownerId);
    for (const c of unownedClients) {
      db.update(clients).set({ ownerId: firstTrainer.id }).where(eq(clients.id, c.id)).run();
    }
    const unownedLib = db.select().from(exerciseLibrary).all().filter(e => !(e as any).ownerId);
    for (const e of unownedLib) {
      db.update(exerciseLibrary).set({ ownerId: firstTrainer.id } as any).where(eq(exerciseLibrary.id, e.id)).run();
    }
    if (unownedClients.length > 0 || unownedLib.length > 0) {
      console.log(`[migration] Assigned ${unownedClients.length} clients and ${unownedLib.length} library entries to trainer ${firstTrainer.email} (id=${firstTrainer.id})`);
    }
  }
}

// Log DB state on startup
{
  const uCount = db.select().from(users).all().length;
  const cCount = db.select().from(credentials).all().length;
  const sCount = db.select().from(sessions).all().length;
  const clientsWithOwner = db.select().from(clients).all().filter(c => c.ownerId);
  const clientsWithoutOwner = db.select().from(clients).all().filter(c => !c.ownerId);
  console.log(`[startup] Users: ${uCount}, Credentials: ${cCount}, Sessions: ${sCount}`);
  console.log(`[startup] Clients with owner: ${clientsWithOwner.length}, without owner: ${clientsWithoutOwner.length}`);
}

export class SqliteStorage {
  // Clients
  getClients(): Client[] {
    return db.select().from(clients).all();
  }
  getClientsByOwner(ownerId: number): Client[] {
    return db.select().from(clients).where(eq(clients.ownerId, ownerId)).all();
  }
  getClient(id: number): Client | undefined {
    return db.select().from(clients).where(eq(clients.id, id)).get();
  }
  createClient(data: InsertClient): Client {
    return db.insert(clients).values(data).returning().get();
  }
  updateClient(id: number, data: Partial<InsertClient>): Client | undefined {
    return db.update(clients).set(data).where(eq(clients.id, id)).returning().get();
  }
  deleteClient(id: number): void {
    // Delete months and their sub-data
    const monthList = db.select().from(months).where(eq(months.clientId, id)).all();
    for (const month of monthList) { this.deleteMonth(month.id); }
    // Delete ABC measurements
    db.delete(abcMeasurements).where(eq(abcMeasurements.clientId, id)).run();
    // Delete note tabs
    db.delete(noteTabs).where(eq(noteTabs.clientId, id)).run();
    // Unlink any users tied to this client (don't delete the user, just unlink)
    const linkedUsers = db.select().from(users).all().filter(u => u.clientId === id);
    for (const u of linkedUsers) {
      db.update(users).set({ clientId: null }).where(eq(users.id, u.id)).run();
    }
    db.delete(clients).where(eq(clients.id, id)).run();
  }

  // Months
  getMonthsByClient(clientId: number): Month[] {
    return db.select().from(months).where(eq(months.clientId, clientId)).all();
  }
  getMonth(id: number): Month | undefined {
    return db.select().from(months).where(eq(months.id, id)).get();
  }
  createMonth(data: InsertMonth): Month {
    return db.insert(months).values(data).returning().get();
  }
  updateMonth(id: number, data: Partial<InsertMonth>): Month | undefined {
    return db.update(months).set(data).where(eq(months.id, id)).returning().get();
  }
  deleteMonth(id: number): void {
    const days = db.select().from(trainingDays).where(eq(trainingDays.monthId, id)).all();
    for (const day of days) { this.deleteTrainingDay(day.id); }
    db.delete(weekDates).where(eq(weekDates.monthId, id)).run();
    db.delete(snapshots).where(eq(snapshots.monthId, id)).run();
    db.delete(months).where(eq(months.id, id)).run();
  }
  copyMonth(monthId: number, newLabel: string, newYear: number, newMonth: number): Month {
    const originalMonth = db.select().from(months).where(eq(months.id, monthId)).get();
    if (!originalMonth) throw new Error("Month not found");
    const maxSort = db.select().from(months).where(eq(months.clientId, originalMonth.clientId)).all();
    const newMonth2 = db.insert(months).values({
      clientId: originalMonth.clientId,
      label: newLabel,
      year: newYear,
      month: newMonth,
      weekCount: originalMonth.weekCount,
      sortOrder: maxSort.length,
    }).returning().get();
    const days = db.select().from(trainingDays).where(eq(trainingDays.monthId, monthId)).all();
    for (const day of days) {
      const newDay = db.insert(trainingDays).values({
        monthId: newMonth2.id, name: day.name, sortOrder: day.sortOrder,
      }).returning().get();
      const exs = db.select().from(exercises).where(eq(exercises.trainingDayId, day.id)).all();
      for (const ex of exs) {
        db.insert(exercises).values({
          trainingDayId: newDay.id, name: ex.name, sets: ex.sets, goalReps: ex.goalReps,
          tempo: ex.tempo, rest: ex.rest, rir: ex.rir, weightType: ex.weightType,
          notes: ex.notes, supersetGroupId: ex.supersetGroupId, sortOrder: ex.sortOrder,
        }).run();
      }
    }
    return newMonth2;
  }

  // Training Days
  getTrainingDaysByMonth(monthId: number): TrainingDay[] {
    return db.select().from(trainingDays).where(eq(trainingDays.monthId, monthId)).all();
  }
  createTrainingDay(data: InsertTrainingDay): TrainingDay {
    return db.insert(trainingDays).values(data).returning().get();
  }
  updateTrainingDay(id: number, data: Partial<InsertTrainingDay>): TrainingDay | undefined {
    return db.update(trainingDays).set(data).where(eq(trainingDays.id, id)).returning().get();
  }
  deleteTrainingDay(id: number): void {
    const exs = db.select().from(exercises).where(eq(exercises.trainingDayId, id)).all();
    for (const ex of exs) { db.delete(weightLogs).where(eq(weightLogs.exerciseId, ex.id)).run(); }
    db.delete(exercises).where(eq(exercises.trainingDayId, id)).run();
    db.delete(weekDates).where(eq(weekDates.trainingDayId, id)).run();
    db.delete(trainingDays).where(eq(trainingDays.id, id)).run();
  }

  // Exercises
  getExercisesByTrainingDay(trainingDayId: number): Exercise[] {
    return db.select().from(exercises).where(eq(exercises.trainingDayId, trainingDayId)).all();
  }
  getExercisesByMonth(monthId: number): Exercise[] {
    const days = db.select().from(trainingDays).where(eq(trainingDays.monthId, monthId)).all();
    const all: Exercise[] = [];
    for (const d of days) { all.push(...db.select().from(exercises).where(eq(exercises.trainingDayId, d.id)).all()); }
    return all;
  }
  createExercise(data: InsertExercise, ownerId?: number): Exercise {
    const ex = db.insert(exercises).values(data).returning().get();
    this.addToExerciseLibrary(data.name, ownerId);
    return ex;
  }
  updateExercise(id: number, data: Partial<InsertExercise>, ownerId?: number): Exercise | undefined {
    const result = db.update(exercises).set(data).where(eq(exercises.id, id)).returning().get();
    if (data.name) { this.addToExerciseLibrary(data.name, ownerId); }
    return result;
  }
  deleteExercise(id: number): void {
    db.delete(weightLogs).where(eq(weightLogs.exerciseId, id)).run();
    db.delete(exercises).where(eq(exercises.id, id)).run();
  }
  clearSupersetGroupId(id: number): void {
    sqlite.prepare("UPDATE exercises SET superset_group_id = NULL WHERE id = ?").run(id);
  }

  // Week Dates
  getWeekDatesByMonth(monthId: number): WeekDate[] {
    return db.select().from(weekDates).where(eq(weekDates.monthId, monthId)).all();
  }
  upsertWeekDate(data: InsertWeekDate): WeekDate {
    const existing = db.select().from(weekDates).where(and(
      eq(weekDates.monthId, data.monthId), eq(weekDates.trainingDayId, data.trainingDayId), eq(weekDates.weekNumber, data.weekNumber)
    )).get();
    if (existing) return db.update(weekDates).set({ date: data.date }).where(eq(weekDates.id, existing.id)).returning().get();
    return db.insert(weekDates).values(data).returning().get();
  }

  // Weight Logs
  getWeightLogsByExercise(exerciseId: number): WeightLog[] {
    return db.select().from(weightLogs).where(eq(weightLogs.exerciseId, exerciseId)).all();
  }
  getWeightLogsByMonth(monthId: number): WeightLog[] {
    const exs = this.getExercisesByMonth(monthId);
    const all: WeightLog[] = [];
    for (const ex of exs) { all.push(...db.select().from(weightLogs).where(eq(weightLogs.exerciseId, ex.id)).all()); }
    return all;
  }
  upsertWeightLog(data: InsertWeightLog): WeightLog {
    const existing = db.select().from(weightLogs).where(and(
      eq(weightLogs.exerciseId, data.exerciseId), eq(weightLogs.weekNumber, data.weekNumber), eq(weightLogs.setNumber, data.setNumber)
    )).get();
    if (existing) return db.update(weightLogs).set({ weight: data.weight, reps: data.reps, notes: data.notes ?? existing.notes }).where(eq(weightLogs.id, existing.id)).returning().get();
    return db.insert(weightLogs).values(data).returning().get();
  }

  // Exercise Library — fuzzy search (active only)
  searchExerciseLibrary(query: string, ownerId?: number): ExerciseLibrary[] {
    const ownerFilter = ownerId != null ? ` AND owner_id = ?` : ``;
    const ownerParams = ownerId != null ? [ownerId] : [];
    if (!query || query.length === 0) {
      return sqlite.prepare(`SELECT id, name, active, owner_id AS ownerId FROM exercise_library WHERE active = 1${ownerFilter} ORDER BY name`).all(...ownerParams) as ExerciseLibrary[];
    }
    const words = query.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) {
      return sqlite.prepare(`SELECT id, name, active, owner_id AS ownerId FROM exercise_library WHERE active = 1${ownerFilter} ORDER BY name`).all(...ownerParams) as ExerciseLibrary[];
    }
    const conditions = words.map(() => `LOWER(name) LIKE ?`).join(" AND ");
    const params = words.map(w => `%${w}%`);
    return sqlite.prepare(`SELECT id, name, active, owner_id AS ownerId FROM exercise_library WHERE active = 1 AND ${conditions}${ownerFilter} ORDER BY name`).all(...params, ...ownerParams) as ExerciseLibrary[];
  }
  // Get ALL exercises (including inactive) for admin
  getAllExerciseLibrary(ownerId?: number): ExerciseLibrary[] {
    if (ownerId != null) {
      return db.select().from(exerciseLibrary).where(eq(exerciseLibrary.ownerId, ownerId)).all();
    }
    return db.select().from(exerciseLibrary).all();
  }
  addToExerciseLibrary(name: string, ownerId?: number): ExerciseLibrary | undefined {
    // Check for existing with same name and owner
    const allMatching = db.select().from(exerciseLibrary).where(eq(exerciseLibrary.name, name)).all();
    const existing = allMatching.find(e => e.ownerId === (ownerId ?? null));
    if (existing) return existing;
    try { return db.insert(exerciseLibrary).values({ name, active: 1, ownerId: ownerId ?? null }).returning().get(); } catch { return undefined; }
  }
  toggleExerciseLibraryActive(id: number, active: boolean): void {
    sqlite.prepare("UPDATE exercise_library SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  }
  updateExerciseLibraryWeightType(id: number, weightType: string): void {
    sqlite.prepare("UPDATE exercise_library SET weight_type = ? WHERE id = ?").run(weightType, id);
  }
  renameExerciseInLibrary(id: number, oldName: string, newName: string): void {
    // Update library entry
    sqlite.prepare("UPDATE exercise_library SET name = ? WHERE id = ?").run(newName, id);
    // Cascade: update all exercises in all training programs that have this name
    sqlite.prepare("UPDATE exercises SET name = ? WHERE name = ?").run(newName, oldName);
  }
  deleteExerciseFromLibrary(id: number): void {
    db.delete(exerciseLibrary).where(eq(exerciseLibrary.id, id)).run();
  }

  // ABC Measurements
  getAbcMeasurements(clientId: number): AbcMeasurement[] {
    return db.select().from(abcMeasurements).where(eq(abcMeasurements.clientId, clientId)).all();
  }
  createAbcMeasurement(data: InsertAbcMeasurement): AbcMeasurement {
    return db.insert(abcMeasurements).values(data).returning().get();
  }
  deleteAbcMeasurement(id: number): void {
    db.delete(abcMeasurements).where(eq(abcMeasurements.id, id)).run();
  }

  // Snapshots (for save state)
  getSnapshotsByMonth(monthId: number): Snapshot[] {
    return db.select().from(snapshots).where(eq(snapshots.monthId, monthId)).all();
  }
  createSnapshot(data: InsertSnapshot): Snapshot {
    return db.insert(snapshots).values(data).returning().get();
  }

  // ===== AUTH: Users =====
  getUserByEmail(email: string): User | undefined {
    return db.select().from(users).where(eq(users.email, email)).get();
  }
  getUserById(id: number): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  getUsers(): User[] {
    return db.select().from(users).all();
  }
  createUser(data: { email: string; displayName: string; role?: string; clientId?: number | null; pinHash?: string }): User {
    return db.insert(users).values({
      email: data.email,
      displayName: data.displayName,
      role: data.role ?? "client",
      clientId: data.clientId ?? null,
      pinHash: data.pinHash ?? null,
    }).returning().get();
  }
  updateUser(id: number, data: Partial<{ email: string; displayName: string; role: string; clientId: number | null; pinHash: string }>): User | undefined {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  }
  deleteUser(id: number): void {
    db.delete(credentials).where(eq(credentials.userId, id)).run();
    db.delete(sessions).where(eq(sessions.userId, id)).run();
    db.delete(users).where(eq(users.id, id)).run();
  }

  // ===== AUTH: Credentials =====
  getCredentialsByUserId(userId: number): Credential[] {
    return db.select().from(credentials).where(eq(credentials.userId, userId)).all();
  }
  getCredentialByCredentialId(credentialId: string): Credential | undefined {
    return db.select().from(credentials).where(eq(credentials.credentialId, credentialId)).get();
  }
  createCredential(data: { userId: number; credentialId: string; publicKey: string; counter: number; transports?: string | null; name?: string | null; createdAt: string }): void {
    db.insert(credentials).values({
      userId: data.userId,
      credentialId: data.credentialId,
      publicKey: data.publicKey,
      counter: data.counter,
      transports: data.transports ?? null,
      name: data.name ?? null,
      createdAt: data.createdAt,
    }).run();
  }
  updateCredentialCounter(credentialId: string, newCounter: number): void {
    db.update(credentials).set({ counter: newCounter }).where(eq(credentials.credentialId, credentialId)).run();
  }
  deleteCredential(id: number, userId: number): boolean {
    const cred = db.select().from(credentials).where(eq(credentials.id, id)).get();
    if (!cred || cred.userId !== userId) return false;
    db.delete(credentials).where(eq(credentials.id, id)).run();
    return true;
  }

  // ===== AUTH: Sessions =====
  createSession(id: string, userId: number, challenge?: string): Session {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    return db.insert(sessions).values({
      id,
      userId,
      challenge: challenge ?? null,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }).returning().get();
  }
  getSession(id: string): (Session & { user: User }) | undefined {
    const result = db.select().from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(eq(sessions.id, id)).get();
    if (!result) return undefined;
    return { ...result.sessions, user: result.users };
  }
  updateSessionChallenge(id: string, challenge: string): void {
    db.update(sessions).set({ challenge }).where(eq(sessions.id, id)).run();
  }
  deleteSession(id: string): void {
    db.delete(sessions).where(eq(sessions.id, id)).run();
  }
  cleanExpiredSessions(): void {
    const now = new Date().toISOString();
    sqlite.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  }

  // Full month data as JSON (for snapshots)
  getFullMonthData(monthId: number): any {
    const month = this.getMonth(monthId);
    const days = this.getTrainingDaysByMonth(monthId);
    const wdList = this.getWeekDatesByMonth(monthId);
    const fullDays = days.map(day => {
      const dayExercises = this.getExercisesByTrainingDay(day.id);
      const exsWithLogs = dayExercises.map(ex => ({
        ...ex,
        weightLogs: this.getWeightLogsByExercise(ex.id),
      }));
      return { ...day, exercises: exsWithLogs };
    });
    return { month, trainingDays: fullDays, weekDates: wdList };
  }

  // Restore month from snapshot data
  restoreMonthFromSnapshot(monthId: number, snapshotData: any): void {
    // Delete current data
    const days = this.getTrainingDaysByMonth(monthId);
    for (const d of days) { this.deleteTrainingDay(d.id); }
    db.delete(weekDates).where(eq(weekDates.monthId, monthId)).run();

    // Update month fields
    if (snapshotData.month) {
      db.update(months).set({
        label: snapshotData.month.label,
        weekCount: snapshotData.month.weekCount,
      }).where(eq(months.id, monthId)).run();
    }

    // Recreate training days, exercises, weight logs
    for (const dayData of snapshotData.trainingDays || []) {
      const newDay = db.insert(trainingDays).values({
        monthId, name: dayData.name, sortOrder: dayData.sortOrder,
      }).returning().get();
      for (const exData of dayData.exercises || []) {
        const newEx = db.insert(exercises).values({
          trainingDayId: newDay.id, name: exData.name, sets: exData.sets,
          goalReps: exData.goalReps, tempo: exData.tempo, rest: exData.rest,
          notes: exData.notes || "", supersetGroupId: exData.supersetGroupId, sortOrder: exData.sortOrder,
        }).returning().get();
        for (const log of exData.weightLogs || []) {
          db.insert(weightLogs).values({
            exerciseId: newEx.id, weekNumber: log.weekNumber,
            setNumber: log.setNumber, weight: log.weight, reps: log.reps, notes: log.notes || "",
          }).run();
        }
      }
    }
    // Recreate week dates
    for (const wd of snapshotData.weekDates || []) {
      // Find new training day matching old sort order
      const newDays = this.getTrainingDaysByMonth(monthId);
      const matchDay = newDays.find(d => d.sortOrder === (snapshotData.trainingDays || []).findIndex((td: any) => td.id === wd.trainingDayId));
      if (matchDay) {
        db.insert(weekDates).values({
          monthId, trainingDayId: matchDay.id, weekNumber: wd.weekNumber, date: wd.date,
        }).run();
      }
    }
  }
  // ============= NOTE TABS =============
  getNoteTabsByClient(clientId: number): NoteTab[] {
    return db.select().from(noteTabs).where(eq(noteTabs.clientId, clientId)).all();
  }
  createNoteTab(data: InsertNoteTab): NoteTab {
    return db.insert(noteTabs).values(data).returning().get();
  }
  updateNoteTab(id: number, data: Partial<InsertNoteTab>): NoteTab | undefined {
    return db.update(noteTabs).set(data).where(eq(noteTabs.id, id)).returning().get();
  }
  deleteNoteTab(id: number): void {
    db.delete(noteTabs).where(eq(noteTabs.id, id)).run();
  }

  // ============= EMAIL WHITELIST =============
  getWhitelistedEmails(): EmailWhitelist[] {
    return db.select().from(emailWhitelist).all();
  }
  getWhitelistedEmail(email: string): EmailWhitelist | undefined {
    return db.select().from(emailWhitelist).where(eq(emailWhitelist.email, email.toLowerCase())).get();
  }
  addWhitelistedEmail(email: string, role: string = "trainer"): EmailWhitelist {
    return db.insert(emailWhitelist).values({
      email: email.toLowerCase(),
      role,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }
  removeWhitelistedEmail(id: number): void {
    db.delete(emailWhitelist).where(eq(emailWhitelist.id, id)).run();
  }
}

export const storage = new SqliteStorage();
