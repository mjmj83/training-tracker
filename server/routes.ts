import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { registerAuthRoutes, authMiddleware } from "./auth";
import ExcelJS from "exceljs";
import { findExerciseImage, searchExerciseImages, cacheGif, getGifDir } from "./exercise-lookup";
import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";

export function registerRoutes(server: Server, app: Express): void {
  // ============= EXERCISE GIF CACHE =============
  app.use("/api/exercise-gifs", express.static(getGifDir(), {
    maxAge: "30d",
    immutable: true,
  }));

  // ============= AUTH =============
  registerAuthRoutes(app, storage);
  app.use(authMiddleware(storage));

  // Helper: verify the current user has access to a given client
  function verifyClientAccess(req: any, clientId: number): boolean {
    const user = req.user;
    if (!user) return false;
    if (user.role === "client") return user.clientId === clientId;
    const client = storage.getClient(clientId);
    return client?.ownerId === user.id;
  }

  // ============= CLIENTS =============
  app.get("/api/clients", (req, res) => {
    const user = (req as any).user;
    console.log(`[GET /api/clients] user: id=${user.id} email=${user.email} role=${user.role}`);
    if (user.role === "client" && user.clientId) {
      const client = storage.getClient(user.clientId);
      return res.json(client ? [client] : []);
    }
    const ownedClients = storage.getClientsByOwner(user.id);
    const allClients = storage.getClients();
    console.log(`[GET /api/clients] owned: ${ownedClients.length}, total: ${allClients.length}, owners: ${allClients.map(c => c.ownerId).join(',')}`);
    res.json(ownedClients);
  });
  app.post("/api/clients", (req, res) => {
    const user = (req as any).user;
    const { name, gender } = req.body;
    if (!name || typeof name !== "string") return res.status(400).json({ error: "Name is required" });
    res.json(storage.createClient({ name, gender: gender || "male", ownerId: user.id }));
  });
  app.get("/api/clients/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (!verifyClientAccess(req, id)) return res.status(403).json({ error: "Access denied" });
    const client = storage.getClient(id);
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  });
  app.patch("/api/clients/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (!verifyClientAccess(req, id)) return res.status(403).json({ error: "Access denied" });
    res.json(storage.updateClient(id, req.body));
  });
  app.delete("/api/clients/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (!verifyClientAccess(req, id)) return res.status(403).json({ error: "Access denied" });
    storage.deleteClient(id);
    res.json({ ok: true });
  });

  // ============= MONTHS =============
  app.get("/api/clients/:clientId/months", (req, res) => {
    const clientId = parseInt(req.params.clientId);
    if (!verifyClientAccess(req, clientId)) return res.status(403).json({ error: "Access denied" });
    res.json(storage.getMonthsByClient(clientId));
  });
  app.post("/api/months", (req, res) => {
    const { clientId, label, year, month, weekCount, sortOrder, startDate } = req.body;
    if (!verifyClientAccess(req, clientId)) return res.status(403).json({ error: "Access denied" });
    res.json(storage.createMonth({ clientId, label, year, month, weekCount: weekCount ?? 4, sortOrder: sortOrder ?? 0, startDate: startDate ?? null }));
  });
  app.patch("/api/months/:id", (req, res) => {
    // TODO: Could tighten by verifying the month's parent client belongs to user
    const updated = storage.updateMonth(parseInt(req.params.id), req.body);
    res.json(updated);
  });
  app.delete("/api/months/:id", (req, res) => {
    // TODO: Could tighten by verifying the month's parent client belongs to user
    storage.deleteMonth(parseInt(req.params.id));
    res.json({ ok: true });
  });
  app.post("/api/months/:id/copy", (req, res) => {
    // TODO: Could tighten by verifying the month's parent client belongs to user
    const { label, year, month, weekCount, startDate } = req.body;
    if (!label || !year || !month) return res.status(400).json({ error: "label, year, and month are required" });
    try {
      const copy = storage.copyMonth(parseInt(req.params.id), label, year, month);
      // Update weekCount and startDate on the copy if provided
      if (weekCount || startDate) {
        const updates: any = {};
        if (weekCount) updates.weekCount = weekCount;
        if (startDate) updates.startDate = startDate;
        const updated = storage.updateMonth(copy.id, updates);
        return res.json(updated);
      }
      res.json(copy);
    }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ============= TRAINING DAYS =============
  // TODO: Could tighten by verifying nested resources belong to an accessible client
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

  // ============= EXERCISE IMAGE SEARCH =============
  app.get("/api/exercise-images/search", async (req, res) => {
    const q = String(req.query.q || "");
    if (q.length < 2) return res.json([]);
    const results = await searchExerciseImages(q, 6);
    res.json(results);
  });
  app.post("/api/exercise-images/select", async (req, res) => {
    const { exerciseId, gifUrl } = req.body;
    if (!exerciseId || !gifUrl) return res.status(400).json({ error: "exerciseId and gifUrl required" });
    const localUrl = await cacheGif(gifUrl);
    if (!localUrl) return res.status(500).json({ error: "Failed to cache image" });
    storage.updateExercise(exerciseId, { imageUrl: localUrl });
    res.json({ imageUrl: localUrl });
  });

  // Upload custom exercise image
  const gifDir = getGifDir();
  const upload = multer({
    storage: multer.diskStorage({
      destination: gifDir,
      filename: (_req, file, cb) => {
        const hash = crypto.randomBytes(6).toString("hex");
        const ext = path.extname(file.originalname) || ".gif";
        cb(null, `custom_${hash}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
      const allowed = /\.(gif|jpg|jpeg|png|webp)$/i;
      if (allowed.test(path.extname(file.originalname))) {
        cb(null, true);
      } else {
        cb(new Error("Alleen GIF, JPG, PNG of WebP"));
      }
    },
  });
  app.post("/api/exercise-images/upload", upload.single("image"), (req, res) => {
    const exerciseId = parseInt(req.body.exerciseId);
    if (!exerciseId || !req.file) return res.status(400).json({ error: "exerciseId and image required" });
    const localUrl = `/api/exercise-gifs/${req.file.filename}`;
    storage.updateExercise(exerciseId, { imageUrl: localUrl });
    res.json({ imageUrl: localUrl });
  });

  // ============= EXERCISES =============
  // TODO: Could tighten by verifying nested resources belong to an accessible client
  app.get("/api/training-days/:dayId/exercises", (req, res) => {
    res.json(storage.getExercisesByTrainingDay(parseInt(req.params.dayId)));
  });
  app.post("/api/exercises", async (req, res) => {
    const user = (req as any).user;
    const { trainingDayId, name, sets, goalReps, tempo, rest, rir, weightType, notes, supersetGroupId, sortOrder } = req.body;
    const imageUrl = await findExerciseImage(name);
    res.json(storage.createExercise({
      trainingDayId, name, sets: sets ?? 3, goalReps: goalReps ?? 10,
      tempo: tempo ?? "", rest: rest ?? 60, rir: rir ?? "", weightType: weightType ?? "weighted", notes: notes ?? "",
      imageUrl, supersetGroupId: supersetGroupId ?? null, sortOrder: sortOrder ?? 0,
    }, user.id));
  });
  app.patch("/api/exercises/:id", async (req, res) => {
    const user = (req as any).user;
    // If name is being changed, look up new image
    if (req.body.name) {
      req.body.imageUrl = await findExerciseImage(req.body.name);
    }
    res.json(storage.updateExercise(parseInt(req.params.id), req.body, user.id));
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
    if (exerciseIds.length > 5) {
      return res.status(400).json({ error: "Maximum 5 exercises per group" });
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
  // TODO: Could tighten by verifying nested resources belong to an accessible client
  app.get("/api/months/:monthId/week-dates", (req, res) => {
    res.json(storage.getWeekDatesByMonth(parseInt(req.params.monthId)));
  });
  app.post("/api/week-dates", (req, res) => {
    const { monthId, trainingDayId, weekNumber, date } = req.body;
    res.json(storage.upsertWeekDate({ monthId, trainingDayId, weekNumber, date }));
  });
  app.post("/api/week-dates/toggle-lock", (req, res) => {
    const { monthId, trainingDayId, weekNumber, locked } = req.body;
    res.json(storage.setWeekLock({ monthId, trainingDayId, weekNumber, locked: locked ? 1 : 0 }));
  });

  // ============= WEIGHT LOGS =============
  // TODO: Could tighten by verifying nested resources belong to an accessible client
  app.get("/api/exercises/:exerciseId/weight-logs", (req, res) => {
    res.json(storage.getWeightLogsByExercise(parseInt(req.params.exerciseId)));
  });
  app.get("/api/months/:monthId/weight-logs", (req, res) => {
    res.json(storage.getWeightLogsByMonth(parseInt(req.params.monthId)));
  });
  app.post("/api/weight-logs", (req, res) => {
    const { exerciseId, weekNumber, setNumber, weight, reps, notes, skipped } = req.body;
    res.json(storage.upsertWeightLog({ exerciseId, weekNumber, setNumber, weight, reps, skipped: skipped ?? 0, notes: notes ?? "" }));
  });
  app.post("/api/weight-logs/clear-week", (req, res) => {
    const { trainingDayId, weekNumber } = req.body;
    storage.clearWeekLogs(trainingDayId, weekNumber);
    res.json({ ok: true });
  });

  // ============= EXERCISE LAST CONFIG =============
  // Get the most recently used settings for an exercise name (across all blocks for this client)
  app.get("/api/clients/:clientId/exercise-config/:name", (req, res) => {
    const clientId = parseInt(req.params.clientId);
    const name = decodeURIComponent(req.params.name);
    if (!verifyClientAccess(req, clientId)) return res.status(403).json({ error: "Access denied" });
    
    // Find the exercise across all blocks for this client, sorted by most recent
    const allMonths = storage.getMonthsByClient(clientId);
    // Sort months by startDate descending
    allMonths.sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    
    for (const month of allMonths) {
      const days = storage.getTrainingDaysByMonth(month.id);
      for (const day of days) {
        const exercises = storage.getExercisesByTrainingDay(day.id);
        const match = exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
        if (match) {
          return res.json({ sets: match.sets, goalReps: match.goalReps, tempo: match.tempo, rest: match.rest, rir: (match as any).rir || "", weightType: (match as any).weightType || "weighted" });
        }
      }
    }
    res.json(null); // No previous config found
  });

  // ============= EXERCISE LIBRARY =============
  app.get("/api/exercise-library", (req, res) => {
    const user = (req as any).user;
    res.json(storage.searchExerciseLibrary((req.query.q as string) || "", user.id));
  });
  app.get("/api/exercise-library/all", (req, res) => {
    const user = (req as any).user;
    res.json(storage.getAllExerciseLibrary(user.id));
  });
  app.post("/api/exercise-library", (req, res) => {
    const user = (req as any).user;
    const { name, searchTags } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    const ex = storage.addToExerciseLibrary(name, user.id);
    if (ex && searchTags !== undefined) {
      storage.updateExerciseLibraryTags(ex.id, searchTags);
    }
    res.json(ex);
  });
  app.patch("/api/exercise-library/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (req.body.active !== undefined) {
      storage.toggleExerciseLibraryActive(id, !!req.body.active);
    }
    if (req.body.name && req.body.oldName) {
      storage.renameExerciseInLibrary(id, req.body.oldName, req.body.name);
    }
    if (req.body.weightType !== undefined) {
      storage.updateExerciseLibraryWeightType(id, req.body.weightType);
    }
    if (req.body.searchTags !== undefined) {
      storage.updateExerciseLibraryTags(id, req.body.searchTags);
    }
    res.json({ ok: true });
  });
  app.delete("/api/exercise-library/:id", (req, res) => {
    storage.deleteExerciseFromLibrary(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ============= ABC MEASUREMENTS =============
  app.get("/api/clients/:clientId/abc", (req, res) => {
    const clientId = parseInt(req.params.clientId);
    if (!verifyClientAccess(req, clientId)) return res.status(403).json({ error: "Access denied" });
    res.json(storage.getAbcMeasurements(clientId));
  });
  app.post("/api/abc", (req, res) => {
    const { clientId, date, gender, weightKg, heightCm, neckCm, abdomenCm, hipCm, bodyFatPct } = req.body;
    if (!verifyClientAccess(req, clientId)) return res.status(403).json({ error: "Access denied" });
    res.json(storage.createAbcMeasurement({ clientId, date, gender, weightKg, heightCm, neckCm, abdomenCm, hipCm, bodyFatPct }));
  });
  app.delete("/api/abc/:id", (req, res) => {
    // TODO: Could tighten by verifying the measurement's parent client belongs to user
    storage.deleteAbcMeasurement(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ============= NOTE TABS =============
  app.get("/api/clients/:clientId/note-tabs", (req, res) => {
    const clientId = parseInt(req.params.clientId);
    if (!verifyClientAccess(req, clientId)) return res.status(403).json({ error: "Access denied" });
    const tabs = storage.getNoteTabsByClient(clientId);
    // Auto-create a default tab if none exist
    if (tabs.length === 0) {
      const tab = storage.createNoteTab({ clientId, name: "Algemeen", content: "", sortOrder: 0 });
      // Migrate old client.notes to first tab
      const client = storage.getClient(clientId);
      if (client?.notes) {
        storage.updateNoteTab(tab.id, { content: client.notes });
        return res.json([{ ...tab, content: client.notes }]);
      }
      return res.json([tab]);
    }
    res.json(tabs);
  });
  app.post("/api/clients/:clientId/note-tabs", (req, res) => {
    const clientId = parseInt(req.params.clientId);
    if (!verifyClientAccess(req, clientId)) return res.status(403).json({ error: "Access denied" });
    const { name } = req.body;
    const tabs = storage.getNoteTabsByClient(clientId);
    const tab = storage.createNoteTab({ clientId, name: name || "Nieuw tabje", content: "", sortOrder: tabs.length });
    res.json(tab);
  });
  app.patch("/api/note-tabs/:id", (req, res) => {
    const updated = storage.updateNoteTab(parseInt(req.params.id), req.body);
    res.json(updated);
  });
  app.delete("/api/note-tabs/:id", (req, res) => {
    storage.deleteNoteTab(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ============= FULL MONTH DATA =============
  // TODO: Could tighten by verifying the month's parent client belongs to user
  app.get("/api/months/:monthId/full", (req, res) => {
    const monthId = parseInt(req.params.monthId);
    const data = storage.getFullMonthData(monthId);
    res.json(data);
  });

  // All blocks for a client (for cross-block charts)
  app.get("/api/clients/:clientId/all-blocks", (req, res) => {
    const clientId = parseInt(req.params.clientId);
    const user = (req as any).user;
    const client = storage.getClient(clientId);
    console.log(`[all-blocks] clientId=${clientId} client.ownerId=${client?.ownerId} user.id=${user?.id} user.role=${user?.role}`);
    if (!verifyClientAccess(req, clientId)) return res.status(403).json({ error: "Access denied" });
    const allMonths = storage.getMonthsByClient(clientId);
    const blocks = allMonths.map(m => storage.getFullMonthData(m.id));
    res.json(blocks);
  });

  // ============= EXPORT =============
  app.get("/api/clients/:clientId/export", async (req, res) => {
    const clientId = parseInt(req.params.clientId);
    if (!verifyClientAccess(req, clientId)) return res.status(403).json({ error: "Access denied" });

    const client = storage.getClient(clientId);
    if (!client) return res.status(404).json({ error: "Client not found" });

    const allMonths = storage.getMonthsByClient(clientId)
      .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));

    const wb = new ExcelJS.Workbook();
    wb.creator = "Training Tracker";

    for (const month of allMonths) {
      const full = storage.getFullMonthData(month.id);
      const weekCount = month.weekCount || 4;
      // Sheet name max 31 chars, no special chars
      const sheetName = (month.label || `Blok ${month.id}`).replace(/[\\\/*?:\[\]]/g, "").slice(0, 31);
      const ws = wb.addWorksheet(sheetName);

      // Build columns: Oefening | sets | reps | tempo | rest | rir | notes | W1S1 | W1S2 ... | WnSm
      const maxSets = Math.max(1, ...(full.trainingDays?.flatMap((d: any) => d.exercises?.map((e: any) => e.sets || 3) || []) || [3]));
      const cols: Partial<ExcelJS.Column>[] = [
        { header: "Dag", key: "day", width: 14 },
        { header: "Oefening", key: "exercise", width: 26 },
        { header: "sets", key: "sets", width: 5 },
        { header: "reps", key: "reps", width: 7 },
        { header: "tempo", key: "tempo", width: 7 },
        { header: "rest", key: "rest", width: 5 },
        { header: "rir", key: "rir", width: 5 },
        { header: "notities", key: "notes", width: 20 },
      ];

      // Week date headers
      const weekDates: Record<string, string> = {}; // "dayId-weekNum" -> date
      for (const wd of full.weekDates || []) {
        weekDates[`${wd.trainingDayId}-${wd.weekNumber}`] = wd.date || "";
      }

      for (let w = 1; w <= weekCount; w++) {
        for (let s = 1; s <= maxSets; s++) {
          cols.push({
            header: `Week ${w} S${s}`,
            key: `w${w}s${s}`,
            width: 11,
          });
        }
      }
      ws.columns = cols;

      // Style header row
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, size: 10 };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0EDE8" } };
      headerRow.alignment = { vertical: "middle" };

      // Add week date info as a second header row
      if (full.trainingDays?.length > 0) {
        const firstDayId = full.trainingDays[0]?.id;
        const dateRowData: Record<string, string> = {};
        for (let w = 1; w <= weekCount; w++) {
          const dateStr = weekDates[`${firstDayId}-${w}`];
          if (dateStr) {
            dateRowData[`w${w}s1`] = dateStr;
          }
        }
        if (Object.keys(dateRowData).length > 0) {
          const dateRow = ws.addRow(dateRowData);
          dateRow.font = { italic: true, size: 9, color: { argb: "FF888888" } };
        }
      }

      // Add exercise rows per training day
      for (const day of (full.trainingDays || []).sort((a: any, b: any) => a.sortOrder - b.sortOrder)) {
        // Empty spacer row between days
        if (ws.rowCount > 2) ws.addRow({});

        for (const ex of (day.exercises || []).sort((a: any, b: any) => a.sortOrder - b.sortOrder)) {
          const rowData: Record<string, any> = {
            day: day.name,
            exercise: ex.name,
            sets: ex.sets,
            reps: ex.goalReps,
            tempo: ex.tempo || "",
            rest: ex.rest,
            rir: ex.rir || "",
            notes: ex.notes || "",
          };

          // Fill weight logs: "kg x reps" format
          for (const log of ex.weightLogs || []) {
            const key = `w${log.weekNumber}s${log.setNumber}`;
            if (ex.weightType === "reps_only") {
              rowData[key] = log.reps != null ? `${log.reps}` : "";
            } else {
              const parts = [];
              if (log.weight != null) parts.push(log.weight);
              if (log.reps != null) parts.push(log.reps);
              rowData[key] = parts.length === 2 ? `${parts[0]} x ${parts[1]}` : (parts[0]?.toString() || "");
            }
          }

          const row = ws.addRow(rowData);
          row.font = { size: 10 };
        }
      }

      // Borders and alignment for data cells
      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        row.eachCell((cell) => {
          cell.alignment = { vertical: "middle" };
        });
      });
    }

    // If no blocks, add an empty sheet
    if (allMonths.length === 0) {
      wb.addWorksheet("Geen data");
    }

    const safeName = client.name.replace(/[^a-zA-Z0-9_\- ]/g, "").trim();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName} - Training Export.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  });

  // ============= SNAPSHOTS / SAVE STATE =============
  // TODO: Could tighten by verifying the month's parent client belongs to user
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
