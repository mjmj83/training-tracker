import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Clients
export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Months (training program block)
export const months = sqliteTable("months", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  label: text("label").notNull(), // e.g. "Maart 2026"
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  weekCount: integer("week_count").notNull().default(4), // 2, 3, or 4
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
  sets: integer("sets").notNull().default(3),
  goalReps: integer("goal_reps").notNull().default(10),
  tempo: text("tempo").default(""),
  rest: integer("rest").default(60), // seconds
  notes: text("notes").default(""), // personal notes/remarks
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
  notes: text("notes").default(""), // per-set notes
});

export const insertWeightLogSchema = createInsertSchema(weightLogs).omit({ id: true });
export type InsertWeightLog = z.infer<typeof insertWeightLogSchema>;
export type WeightLog = typeof weightLogs.$inferSelect;

// Exercise name library for search/autocomplete
export const exerciseLibrary = sqliteTable("exercise_library", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const insertExerciseLibrarySchema = createInsertSchema(exerciseLibrary).omit({ id: true });
export type InsertExerciseLibrary = z.infer<typeof insertExerciseLibrarySchema>;
export type ExerciseLibrary = typeof exerciseLibrary.$inferSelect;

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
