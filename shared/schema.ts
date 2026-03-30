import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Clients
export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  gender: text("gender").notNull().default("male"), // 'male' | 'female'
  notes: text("notes").default(""),
  bfReminderEnabled: integer("bf_reminder_enabled").notNull().default(1), // 1 = on, 0 = off
  ownerId: integer("owner_id"), // user who owns this client
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Client note tabs
export const noteTabs = sqliteTable("note_tabs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  content: text("content").default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertNoteTabSchema = createInsertSchema(noteTabs).omit({ id: true });
export type InsertNoteTab = z.infer<typeof insertNoteTabSchema>;
export type NoteTab = typeof noteTabs.$inferSelect;

// Training blocks (formerly "months")
export const months = sqliteTable("months", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  label: text("label").notNull(), // e.g. "Vakantie Ibiza"
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12 (kept for compat)
  weekCount: integer("week_count").notNull().default(4), // 2-8
  startDate: text("start_date"), // ISO date e.g. "2026-03-24"
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertMonthSchema = createInsertSchema(months).omit({ id: true });
export type InsertMonth = z.infer<typeof insertMonthSchema>;
export type Month = typeof months.$inferSelect;

// Training days (horizontal rulers / sections)
export const trainingDays = sqliteTable("training_days", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  monthId: integer("month_id").notNull().references(() => months.id),
  name: text("name").notNull(), // e.g. "Day 1 - Push", "Day 2 - Pull"
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertTrainingDaySchema = createInsertSchema(trainingDays).omit({ id: true });
export type InsertTrainingDay = z.infer<typeof insertTrainingDaySchema>;
export type TrainingDay = typeof trainingDays.$inferSelect;

// Exercises (rows in the spreadsheet)
export const exercises = sqliteTable("exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trainingDayId: integer("training_day_id").notNull().references(() => trainingDays.id),
  name: text("name").notNull(),
  sets: text("sets").notNull().default("3"), // e.g. "3" or "3-4"
  goalReps: text("goal_reps").notNull().default("10"), // e.g. "10" or "10-15"
  tempo: text("tempo").default(""),
  rest: text("rest").default("60"), // seconds, e.g. "60" or "60-90"
  rir: text("rir").default(""), // Reps In Reserve e.g. "2" or "0-1"
  weightType: text("weight_type").notNull().default("weighted"), // 'weighted' | 'reps_only' | 'bodyweight'
  notes: text("notes").default(""), // personal notes/remarks
  imageUrl: text("image_url"), // exercise image from ExerciseDB
  supersetGroupId: integer("superset_group_id"), // null = standalone, same value = grouped superset
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertExerciseSchema = createInsertSchema(exercises).omit({ id: true });
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type Exercise = typeof exercises.$inferSelect;

// Week dates (the date headers under W1-W4)
export const weekDates = sqliteTable("week_dates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  monthId: integer("month_id").notNull().references(() => months.id),
  trainingDayId: integer("training_day_id").notNull().references(() => trainingDays.id),
  weekNumber: integer("week_number").notNull(), // 1-4
  date: text("date"), // ISO date string e.g. "2026-03-05"
});

export const insertWeekDateSchema = createInsertSchema(weekDates).omit({ id: true });
export type InsertWeekDate = z.infer<typeof insertWeekDateSchema>;
export type WeekDate = typeof weekDates.$inferSelect;

// Weight logs — individual set entries per week
export const weightLogs = sqliteTable("weight_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id),
  weekNumber: integer("week_number").notNull(), // 1-4
  setNumber: integer("set_number").notNull(), // 1-5
  weight: real("weight"), // kg
  reps: integer("reps"), // actual reps achieved
  skipped: integer("skipped").notNull().default(0), // 1 = skipped
  notes: text("notes").default(""), // per-set notes
});

export const insertWeightLogSchema = createInsertSchema(weightLogs).omit({ id: true });
export type InsertWeightLog = z.infer<typeof insertWeightLogSchema>;
export type WeightLog = typeof weightLogs.$inferSelect;

// Exercise name library for search/autocomplete
export const exerciseLibrary = sqliteTable("exercise_library", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  searchTags: text("search_tags").default(""), // comma-separated search terms
  active: integer("active").notNull().default(1), // 1 = active, 0 = inactive
  weightType: text("weight_type").notNull().default("weighted"), // 'weighted' | 'reps_only'
  ownerId: integer("owner_id"), // user who owns this library entry
});

export const insertExerciseLibrarySchema = createInsertSchema(exerciseLibrary).omit({ id: true });
export type InsertExerciseLibrary = z.infer<typeof insertExerciseLibrarySchema>;
export type ExerciseLibrary = typeof exerciseLibrary.$inferSelect;

// ABC (Army Body Composition) measurements — AR 600-9
export const abcMeasurements = sqliteTable("abc_measurements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  date: text("date").notNull(), // ISO date
  gender: text("gender").notNull(), // 'male' | 'female'
  weightKg: real("weight_kg"), // kept for display but not used in formula
  heightCm: real("height_cm").notNull(), // required for AR 600-9
  neckCm: real("neck_cm").notNull(), // circumference below larynx
  abdomenCm: real("abdomen_cm").notNull(), // waist at navel (men) / narrowest (women)
  hipCm: real("hip_cm"), // widest part of buttocks — required for women only
  bodyFatPct: real("body_fat_pct").notNull(), // calculated result
});

export const insertAbcMeasurementSchema = createInsertSchema(abcMeasurements).omit({ id: true });
export type InsertAbcMeasurement = z.infer<typeof insertAbcMeasurementSchema>;
export type AbcMeasurement = typeof abcMeasurements.$inferSelect;

// Snapshots for undo/redo — stores full month state as JSON
export const snapshots = sqliteTable("snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  monthId: integer("month_id").notNull().references(() => months.id),
  data: text("data").notNull(), // JSON blob of full month state
  createdAt: text("created_at").notNull(),
});

export const insertSnapshotSchema = createInsertSchema(snapshots).omit({ id: true });
export type InsertSnapshot = z.infer<typeof insertSnapshotSchema>;
export type Snapshot = typeof snapshots.$inferSelect;

// Auth: users
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("client"), // 'trainer' | 'client'
  pinHash: text("pin_hash"), // bcrypt hash of PIN code
  clientId: integer("client_id").references(() => clients.id), // linked client for 'client' role
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Auth: passkey credentials
export const credentials = sqliteTable("credentials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  credentialId: text("credential_id").notNull().unique(), // base64url encoded
  publicKey: text("public_key").notNull(), // base64url encoded
  counter: integer("counter").notNull().default(0),
  transports: text("transports"), // JSON array
  name: text("name"), // user-friendly name e.g. "MacBook Touch ID"
  createdAt: text("created_at").notNull(),
});

export type Credential = typeof credentials.$inferSelect;

// Auth: sessions
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // random session token
  userId: integer("user_id").notNull().references(() => users.id),
  challenge: text("challenge"), // temporary WebAuthn challenge
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export type Session = typeof sessions.$inferSelect;

// Email whitelist — only whitelisted emails can register
export const emailWhitelist = sqliteTable("email_whitelist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("trainer"), // 'trainer' | 'client'
  createdAt: text("created_at").notNull(),
});

export const insertEmailWhitelistSchema = createInsertSchema(emailWhitelist).omit({ id: true });
export type InsertEmailWhitelist = z.infer<typeof insertEmailWhitelistSchema>;
export type EmailWhitelist = typeof emailWhitelist.$inferSelect;
