import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, like, or } from "drizzle-orm";
import {
  clients, insertClientSchema, type Client, type InsertClient,
  months, type Month, type InsertMonth,
  trainingDays, type TrainingDay, type InsertTrainingDay,
  exercises, type Exercise, type InsertExercise,
  weekDates, type WeekDate, type InsertWeekDate,
  weightLogs, type WeightLog, type InsertWeightLog,
  exerciseLibrary, type ExerciseLibrary, type InsertExerciseLibrary,
} from "@shared/schema";

const sqlite = new Database("training.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS months (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    label TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
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
    reps INTEGER
  );
  CREATE TABLE IF NOT EXISTS exercise_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
`);

export interface IStorage {
  // Clients
  getClients(): Client[];
  createClient(data: InsertClient): Client;
  deleteClient(id: number): void;

  // Months
  getMonthsByClient(clientId: number): Month[];
  createMonth(data: InsertMonth): Month;
  deleteMonth(id: number): void;
  copyMonth(monthId: number, newLabel: string, newYear: number, newMonth: number): Month;

  // Training Days
  getTrainingDaysByMonth(monthId: number): TrainingDay[];
  createTrainingDay(data: InsertTrainingDay): TrainingDay;
  updateTrainingDay(id: number, data: Partial<InsertTrainingDay>): TrainingDay | undefined;
  deleteTrainingDay(id: number): void;

  // Exercises
  getExercisesByTrainingDay(trainingDayId: number): Exercise[];
  getExercisesByMonth(monthId: number): Exercise[];
  createExercise(data: InsertExercise): Exercise;
  updateExercise(id: number, data: Partial<InsertExercise>): Exercise | undefined;
  deleteExercise(id: number): void;

  // Week Dates
  getWeekDatesByMonth(monthId: number): WeekDate[];
  upsertWeekDate(data: InsertWeekDate): WeekDate;

  // Weight Logs
  getWeightLogsByExercise(exerciseId: number): WeightLog[];
  getWeightLogsByMonth(monthId: number): WeightLog[];
  upsertWeightLog(data: InsertWeightLog): WeightLog;

  // Exercise Library
  searchExerciseLibrary(query: string): ExerciseLibrary[];
  addToExerciseLibrary(name: string): ExerciseLibrary | undefined;
}

export class SqliteStorage implements IStorage {
  // Clients
  getClients(): Client[] {
    return db.select().from(clients).all();
  }

  createClient(data: InsertClient): Client {
    return db.insert(clients).values(data).returning().get();
  }

  deleteClient(id: number): void {
    // Cascade: delete all months, training days, exercises, weight logs
    const monthList = db.select().from(months).where(eq(months.clientId, id)).all();
    for (const month of monthList) {
      this.deleteMonth(month.id);
    }
    db.delete(clients).where(eq(clients.id, id)).run();
  }

  // Months
  getMonthsByClient(clientId: number): Month[] {
    return db.select().from(months).where(eq(months.clientId, clientId)).all();
  }

  createMonth(data: InsertMonth): Month {
    return db.insert(months).values(data).returning().get();
  }

  deleteMonth(id: number): void {
    const days = db.select().from(trainingDays).where(eq(trainingDays.monthId, id)).all();
    for (const day of days) {
      this.deleteTrainingDay(day.id);
    }
    db.delete(weekDates).where(eq(weekDates.monthId, id)).run();
    db.delete(months).where(eq(months.id, id)).run();
  }

  copyMonth(monthId: number, newLabel: string, newYear: number, newMonth: number): Month {
    const originalMonth = db.select().from(months).where(eq(months.id, monthId)).get();
    if (!originalMonth) throw new Error("Month not found");

    // Create new month
    const maxSort = db.select().from(months).where(eq(months.clientId, originalMonth.clientId)).all();
    const newMonth2 = db.insert(months).values({
      clientId: originalMonth.clientId,
      label: newLabel,
      year: newYear,
      month: newMonth,
      sortOrder: maxSort.length,
    }).returning().get();

    // Copy training days and exercises (but not weight data)
    const days = db.select().from(trainingDays).where(eq(trainingDays.monthId, monthId)).all();
    for (const day of days) {
      const newDay = db.insert(trainingDays).values({
        monthId: newMonth2.id,
        name: day.name,
        sortOrder: day.sortOrder,
      }).returning().get();

      const exs = db.select().from(exercises).where(eq(exercises.trainingDayId, day.id)).all();
      for (const ex of exs) {
        db.insert(exercises).values({
          trainingDayId: newDay.id,
          name: ex.name,
          sets: ex.sets,
          goalReps: ex.goalReps,
          tempo: ex.tempo,
          rest: ex.rest,
          sortOrder: ex.sortOrder,
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
    for (const ex of exs) {
      db.delete(weightLogs).where(eq(weightLogs.exerciseId, ex.id)).run();
    }
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
    const dayIds = days.map(d => d.id);
    if (dayIds.length === 0) return [];
    // Get all exercises for all days in this month
    const allExercises: Exercise[] = [];
    for (const dayId of dayIds) {
      const exs = db.select().from(exercises).where(eq(exercises.trainingDayId, dayId)).all();
      allExercises.push(...exs);
    }
    return allExercises;
  }

  createExercise(data: InsertExercise): Exercise {
    const ex = db.insert(exercises).values(data).returning().get();
    // Also add to exercise library
    this.addToExerciseLibrary(data.name);
    return ex;
  }

  updateExercise(id: number, data: Partial<InsertExercise>): Exercise | undefined {
    const result = db.update(exercises).set(data).where(eq(exercises.id, id)).returning().get();
    if (data.name) {
      this.addToExerciseLibrary(data.name);
    }
    return result;
  }

  deleteExercise(id: number): void {
    db.delete(weightLogs).where(eq(weightLogs.exerciseId, id)).run();
    db.delete(exercises).where(eq(exercises.id, id)).run();
  }

  // Week Dates
  getWeekDatesByMonth(monthId: number): WeekDate[] {
    return db.select().from(weekDates).where(eq(weekDates.monthId, monthId)).all();
  }

  upsertWeekDate(data: InsertWeekDate): WeekDate {
    // Check if exists
    const existing = db.select().from(weekDates)
      .where(and(
        eq(weekDates.monthId, data.monthId),
        eq(weekDates.trainingDayId, data.trainingDayId),
        eq(weekDates.weekNumber, data.weekNumber)
      )).get();

    if (existing) {
      return db.update(weekDates).set({ date: data.date }).where(eq(weekDates.id, existing.id)).returning().get();
    }
    return db.insert(weekDates).values(data).returning().get();
  }

  // Weight Logs
  getWeightLogsByExercise(exerciseId: number): WeightLog[] {
    return db.select().from(weightLogs).where(eq(weightLogs.exerciseId, exerciseId)).all();
  }

  getWeightLogsByMonth(monthId: number): WeightLog[] {
    const exs = this.getExercisesByMonth(monthId);
    const allLogs: WeightLog[] = [];
    for (const ex of exs) {
      const logs = db.select().from(weightLogs).where(eq(weightLogs.exerciseId, ex.id)).all();
      allLogs.push(...logs);
    }
    return allLogs;
  }

  upsertWeightLog(data: InsertWeightLog): WeightLog {
    const existing = db.select().from(weightLogs)
      .where(and(
        eq(weightLogs.exerciseId, data.exerciseId),
        eq(weightLogs.weekNumber, data.weekNumber),
        eq(weightLogs.setNumber, data.setNumber)
      )).get();

    if (existing) {
      return db.update(weightLogs).set({ weight: data.weight, reps: data.reps }).where(eq(weightLogs.id, existing.id)).returning().get();
    }
    return db.insert(weightLogs).values(data).returning().get();
  }

  // Exercise Library
  searchExerciseLibrary(query: string): ExerciseLibrary[] {
    if (!query || query.length === 0) {
      return db.select().from(exerciseLibrary).all();
    }
    const lowerQuery = `%${query.toLowerCase()}%`;
    return db.select().from(exerciseLibrary)
      .where(like(exerciseLibrary.name, lowerQuery))
      .all();
  }

  addToExerciseLibrary(name: string): ExerciseLibrary | undefined {
    const existing = db.select().from(exerciseLibrary)
      .where(eq(exerciseLibrary.name, name)).get();
    if (existing) return existing;
    try {
      return db.insert(exerciseLibrary).values({ name }).returning().get();
    } catch {
      return undefined;
    }
  }
}

export const storage = new SqliteStorage();
