import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";

export function registerRoutes(server: Server, app: Express): void {
  // ============= CLIENTS =============
  app.get("/api/clients", (_req, res) => { res.json(storage.getClients()); });
  app.post("/api/clients", (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== "string") return res.status(400).json({ error: "Name is required" });
    res.json(storage.createClient({ name }));
  });
  app.get("/api/clients/:id", (req, res) => {
    const client = storage.getClient(parseInt(req.params.id));
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  });
  app.patch("/api/clients/:id", (req, res) => {
    res.json(storage.updateClient(parseInt(req.params.id), req.body));
  });
  app.delete("/api/clients/:id", (req, res) => {
    storage.deleteClient(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ============= MONTHS =============
  app.get("/api/clients/:clientId/months", (req, res) => {
    res.json(storage.getMonthsByClient(parseInt(req.params.clientId)));
  });
  app.post("/api/months", (req, res) => {
    const { clientId, label, year, month, weekCount, sortOrder } = req.body;
    res.json(storage.createMonth({ clientId, label, year, month, weekCount: weekCount ?? 4, sortOrder: sortOrder ?? 0 }));
  });
  app.patch("/api/months/:id", (req, res) => {
    const updated = storage.updateMonth(parseInt(req.params.id), req.body);
    res.json(updated);
  });
  app.delete("/api/months/:id", (req, res) => {
    storage.deleteMonth(parseInt(req.params.id));
    res.json({ ok: true });
  });
  app.post("/api/months/:id/copy", (req, res) => {
    const { label, year, month } = req.body;
    if (!label || !year || !month) return res.status(400).json({ error: "label, year, and month are required" });
    try { res.json(storage.copyMonth(parseInt(req.params.id), label, year, month)); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ============= TRAINING DAYS =============
  app.get("/api/months/:monthId/training-days", (req, res) => {
    res.json(storage.getTrainingDaysByMonth(parseInt(req.params.monthId)));
  });
  app.post("/api/training-days", (req, res) => {
    const { monthId, name, sortOrder } = req.body;
    res.json(storage.createTrainingDay({ monthId, name, sortOrder: sortOrder ?? 0 }));
  });
  app.patch("/api/training-days/:id", (req, res) => {
    res.json(storage.updateTrainingDay(parseInt(req.params.id), req.body));
  });
  app.delete("/api/training-days/:id", (req, res) => {
    storage.deleteTrainingDay(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ============= EXERCISES =============
  app.get("/api/training-days/:dayId/exercises", (req, res) => {
    res.json(storage.getExercisesByTrainingDay(parseInt(req.params.dayId)));
  });
  app.post("/api/exercises", (req, res) => {
    const { trainingDayId, name, sets, goalReps, tempo, rest, notes, supersetGroupId, sortOrder } = req.body;
    res.json(storage.createExercise({
      trainingDayId, name, sets: sets ?? 3, goalReps: goalReps ?? 10,
      tempo: tempo ?? "", rest: rest ?? 60, notes: notes ?? "", supersetGroupId: supersetGroupId ?? null, sortOrder: sortOrder ?? 0,
    }));
  });
  app.patch("/api/exercises/:id", (req, res) => {
    res.json(storage.updateExercise(parseInt(req.params.id), req.body));
  });
  app.delete("/api/exercises/:id", (req, res) => {
    storage.deleteExercise(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ============= SUPERSET =============
  app.post("/api/exercises/superset", (req, res) => {
    const { exerciseIds } = req.body;
    if (!exerciseIds || !Array.isArray(exerciseIds) || exerciseIds.length < 2) {
      return res.status(400).json({ error: "Need at least 2 exercise IDs" });
    }
    // Use the smallest id as the group id
    const groupId = Math.min(...exerciseIds);
    for (const id of exerciseIds) {
      storage.updateExercise(id, { supersetGroupId: groupId });
    }
    res.json({ ok: true, groupId });
  });
  app.post("/api/exercises/:id/unsuperset", (req, res) => {
    storage.clearSupersetGroupId(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ============= WEEK DATES =============
  app.get("/api/months/:monthId/week-dates", (req, res) => {
    res.json(storage.getWeekDatesByMonth(parseInt(req.params.monthId)));
  });
  app.post("/api/week-dates", (req, res) => {
    const { monthId, trainingDayId, weekNumber, date } = req.body;
    res.json(storage.upsertWeekDate({ monthId, trainingDayId, weekNumber, date }));
  });

  // ============= WEIGHT LOGS =============
  app.get("/api/exercises/:exerciseId/weight-logs", (req, res) => {
    res.json(storage.getWeightLogsByExercise(parseInt(req.params.exerciseId)));
  });
  app.get("/api/months/:monthId/weight-logs", (req, res) => {
    res.json(storage.getWeightLogsByMonth(parseInt(req.params.monthId)));
  });
  app.post("/api/weight-logs", (req, res) => {
    const { exerciseId, weekNumber, setNumber, weight, reps, notes } = req.body;
    res.json(storage.upsertWeightLog({ exerciseId, weekNumber, setNumber, weight, reps, notes: notes ?? "" }));
  });

  // ============= EXERCISE LIBRARY =============
  app.get("/api/exercise-library", (req, res) => {
    res.json(storage.searchExerciseLibrary((req.query.q as string) || ""));
  });

  // ============= FULL MONTH DATA =============
  app.get("/api/months/:monthId/full", (req, res) => {
    const monthId = parseInt(req.params.monthId);
    const data = storage.getFullMonthData(monthId);
    res.json(data);
  });

  // ============= SNAPSHOTS / SAVE STATE =============
  app.get("/api/months/:monthId/snapshots", (req, res) => {
    res.json(storage.getSnapshotsByMonth(parseInt(req.params.monthId)));
  });
  app.post("/api/months/:monthId/save", (req, res) => {
    const monthId = parseInt(req.params.monthId);
    const fullData = storage.getFullMonthData(monthId);
    const snapshot = storage.createSnapshot({
      monthId,
      data: JSON.stringify(fullData),
      createdAt: new Date().toISOString(),
    });
    res.json(snapshot);
  });
  // Direct restore from JSON data (for undo/redo)
  app.post("/api/months/:monthId/restore-data", (req, res) => {
    const monthId = parseInt(req.params.monthId);
    try {
      storage.restoreMonthFromSnapshot(monthId, req.body);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/months/:monthId/restore/:snapshotId", (req, res) => {
    const monthId = parseInt(req.params.monthId);
    const snapshotId = parseInt(req.params.snapshotId);
    const snapshotsList = storage.getSnapshotsByMonth(monthId);
    const snap = snapshotsList.find(s => s.id === snapshotId);
    if (!snap) return res.status(404).json({ error: "Snapshot not found" });
    try {
      const data = JSON.parse(snap.data);
      storage.restoreMonthFromSnapshot(monthId, data);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
