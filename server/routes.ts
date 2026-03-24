import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";

export function registerRoutes(server: Server, app: Express): void {
  // ============= CLIENTS =============
  app.get("/api/clients", (_req, res) => {
    const clients = storage.getClients();
    res.json(clients);
  });

  app.post("/api/clients", (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Name is required" });
    }
    const client = storage.createClient({ name });
    res.json(client);
  });

  app.delete("/api/clients/:id", (req, res) => {
    const id = parseInt(req.params.id);
    storage.deleteClient(id);
    res.json({ ok: true });
  });

  // ============= MONTHS =============
  app.get("/api/clients/:clientId/months", (req, res) => {
    const clientId = parseInt(req.params.clientId);
    const months = storage.getMonthsByClient(clientId);
    res.json(months);
  });

  app.post("/api/months", (req, res) => {
    const { clientId, label, year, month, sortOrder } = req.body;
    const m = storage.createMonth({ clientId, label, year, month, sortOrder: sortOrder ?? 0 });
    res.json(m);
  });

  app.delete("/api/months/:id", (req, res) => {
    const id = parseInt(req.params.id);
    storage.deleteMonth(id);
    res.json({ ok: true });
  });

  app.post("/api/months/:id/copy", (req, res) => {
    const id = parseInt(req.params.id);
    const { label, year, month } = req.body;
    if (!label || !year || !month) {
      return res.status(400).json({ error: "label, year, and month are required" });
    }
    try {
      const newMonth = storage.copyMonth(id, label, year, month);
      res.json(newMonth);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ============= TRAINING DAYS =============
  app.get("/api/months/:monthId/training-days", (req, res) => {
    const monthId = parseInt(req.params.monthId);
    const days = storage.getTrainingDaysByMonth(monthId);
    res.json(days);
  });

  app.post("/api/training-days", (req, res) => {
    const { monthId, name, sortOrder } = req.body;
    const day = storage.createTrainingDay({ monthId, name, sortOrder: sortOrder ?? 0 });
    res.json(day);
  });

  app.patch("/api/training-days/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const updated = storage.updateTrainingDay(id, req.body);
    res.json(updated);
  });

  app.delete("/api/training-days/:id", (req, res) => {
    const id = parseInt(req.params.id);
    storage.deleteTrainingDay(id);
    res.json({ ok: true });
  });

  // ============= EXERCISES =============
  app.get("/api/training-days/:dayId/exercises", (req, res) => {
    const dayId = parseInt(req.params.dayId);
    const exs = storage.getExercisesByTrainingDay(dayId);
    res.json(exs);
  });

  app.post("/api/exercises", (req, res) => {
    const { trainingDayId, name, sets, goalReps, tempo, rest, sortOrder } = req.body;
    const ex = storage.createExercise({
      trainingDayId,
      name,
      sets: sets ?? 3,
      goalReps: goalReps ?? 10,
      tempo: tempo ?? "",
      rest: rest ?? 60,
      sortOrder: sortOrder ?? 0,
    });
    res.json(ex);
  });

  app.patch("/api/exercises/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const updated = storage.updateExercise(id, req.body);
    res.json(updated);
  });

  app.delete("/api/exercises/:id", (req, res) => {
    const id = parseInt(req.params.id);
    storage.deleteExercise(id);
    res.json({ ok: true });
  });

  // ============= WEEK DATES =============
  app.get("/api/months/:monthId/week-dates", (req, res) => {
    const monthId = parseInt(req.params.monthId);
    const dates = storage.getWeekDatesByMonth(monthId);
    res.json(dates);
  });

  app.post("/api/week-dates", (req, res) => {
    const { monthId, trainingDayId, weekNumber, date } = req.body;
    const wd = storage.upsertWeekDate({ monthId, trainingDayId, weekNumber, date });
    res.json(wd);
  });

  // ============= WEIGHT LOGS =============
  app.get("/api/exercises/:exerciseId/weight-logs", (req, res) => {
    const exerciseId = parseInt(req.params.exerciseId);
    const logs = storage.getWeightLogsByExercise(exerciseId);
    res.json(logs);
  });

  app.get("/api/months/:monthId/weight-logs", (req, res) => {
    const monthId = parseInt(req.params.monthId);
    const logs = storage.getWeightLogsByMonth(monthId);
    res.json(logs);
  });

  app.post("/api/weight-logs", (req, res) => {
    const { exerciseId, weekNumber, setNumber, weight, reps } = req.body;
    const log = storage.upsertWeightLog({ exerciseId, weekNumber, setNumber, weight, reps });
    res.json(log);
  });

  // ============= EXERCISE LIBRARY =============
  app.get("/api/exercise-library", (req, res) => {
    const query = (req.query.q as string) || "";
    const results = storage.searchExerciseLibrary(query);
    res.json(results);
  });

  // ============= FULL MONTH DATA (bulk fetch) =============
  app.get("/api/months/:monthId/full", (req, res) => {
    const monthId = parseInt(req.params.monthId);
    const days = storage.getTrainingDaysByMonth(monthId);
    const weekDatesList = storage.getWeekDatesByMonth(monthId);

    const fullDays = days.map(day => {
      const dayExercises = storage.getExercisesByTrainingDay(day.id);
      const exercisesWithLogs = dayExercises.map(ex => {
        const logs = storage.getWeightLogsByExercise(ex.id);
        return { ...ex, weightLogs: logs };
      });
      return { ...day, exercises: exercisesWithLogs };
    });

    res.json({ trainingDays: fullDays, weekDates: weekDatesList });
  });
}
