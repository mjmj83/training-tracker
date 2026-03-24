import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, like } from "drizzle-orm";
import {
  clients, type Client, type InsertClient,
  months, type Month, type InsertMonth,
  trainingDays, type TrainingDay, type InsertTrainingDay,
  exercises, type Exercise, type InsertExercise,
  weekDates, type WeekDate, type InsertWeekDate,
  weightLogs, type WeightLog, type InsertWeightLog,
  exerciseLibrary, type ExerciseLibrary,
  snapshots, type Snapshot, type InsertSnapshot,
} from "@shared/schema";

const sqlite = new Database("training.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);

// Create tables + migrations
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
    reps INTEGER
  );
  CREATE TABLE IF NOT EXISTS exercise_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
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

export class SqliteStorage {
  // Clients
  getClients(): Client[] {
    return db.select().from(clients).all();
  }
  createClient(data: InsertClient): Client {
    return db.insert(clients).values(data).returning().get();
  }
  deleteClient(id: number): void {
    const monthList = db.select().from(months).where(eq(months.clientId, id)).all();
    for (const month of monthList) { this.deleteMonth(month.id); }
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
          tempo: ex.tempo, rest: ex.rest, supersetGroupId: ex.supersetGroupId, sortOrder: ex.sortOrder,
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
  createExercise(data: InsertExercise): Exercise {
    const ex = db.insert(exercises).values(data).returning().get();
    this.addToExerciseLibrary(data.name);
    return ex;
  }
  updateExercise(id: number, data: Partial<InsertExercise>): Exercise | undefined {
    const result = db.update(exercises).set(data).where(eq(exercises.id, id)).returning().get();
    if (data.name) { this.addToExerciseLibrary(data.name); }
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
    if (existing) return db.update(weightLogs).set({ weight: data.weight, reps: data.reps }).where(eq(weightLogs.id, existing.id)).returning().get();
    return db.insert(weightLogs).values(data).returning().get();
  }

  // Exercise Library
  searchExerciseLibrary(query: string): ExerciseLibrary[] {
    if (!query || query.length === 0) return db.select().from(exerciseLibrary).all();
    return db.select().from(exerciseLibrary).where(like(exerciseLibrary.name, `%${query.toLowerCase()}%`)).all();
  }
  addToExerciseLibrary(name: string): ExerciseLibrary | undefined {
    const existing = db.select().from(exerciseLibrary).where(eq(exerciseLibrary.name, name)).get();
    if (existing) return existing;
    try { return db.insert(exerciseLibrary).values({ name }).returning().get(); } catch { return undefined; }
  }

  // Snapshots (for save state)
  getSnapshotsByMonth(monthId: number): Snapshot[] {
    return db.select().from(snapshots).where(eq(snapshots.monthId, monthId)).all();
  }
  createSnapshot(data: InsertSnapshot): Snapshot {
    return db.insert(snapshots).values(data).returning().get();
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
          supersetGroupId: exData.supersetGroupId, sortOrder: exData.sortOrder,
        }).returning().get();
        for (const log of exData.weightLogs || []) {
          db.insert(weightLogs).values({
            exerciseId: newEx.id, weekNumber: log.weekNumber,
            setNumber: log.setNumber, weight: log.weight, reps: log.reps,
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
}

export const storage = new SqliteStorage();
