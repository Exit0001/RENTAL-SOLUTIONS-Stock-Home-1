import type { Express } from "express";
import { createServer, type Server } from "http";
import { requireAuth } from "./middleware/requireAuth";
import { companiesRouter } from "./routes/companies";
import { authRouter } from "./routes/auth";
import { stockRouter } from "./routes/stock";
import { containersRouter } from "./routes/containers";
import { jobsRouter } from "./routes/jobs";
import { jobTemplatesRouter } from "./routes/jobTemplates";
import { equipmentSetsRouter } from "./routes/equipmentSets";
import { financeRouter } from "./routes/finance";
import { maintenanceRouter } from "./routes/maintenance";
import { activityRouter } from "./routes/activity";
import { notificationsRouter } from "./routes/notifications";
import { pushRouter } from "./routes/push";
import { statsRouter } from "./routes/stats";
import { analyticsRouter } from "./routes/analytics";
import { catalogRouter } from "./routes/catalog";
import { backupRouter } from "./routes/backup";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // routes ที่ไม่ต้องการ auth
  app.use("/api/companies", companiesRouter);
  app.use("/api/auth",      authRouter);

  // requireCompany ทำงานก่อนทุก route ที่เหลือ
  app.use("/api", requireAuth);

  // ─── Routes ───────────────────────────────────────────────
  app.use("/api/stock",       stockRouter);
  app.use("/api/containers",  containersRouter);
  app.use("/api/jobs",        jobsRouter);
  app.use("/api/job-templates", jobTemplatesRouter);
  app.use("/api/equipment-sets", equipmentSetsRouter);
  app.use("/api/finance",     financeRouter);
  app.use("/api/maintenance", maintenanceRouter);
  app.use("/api/activity",    activityRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/push",        pushRouter);
  app.use("/api/stats",       statsRouter);
  app.use("/api/analytics",   analyticsRouter);
  app.use("/api/catalog",     catalogRouter);
  app.use("/api/backup",      backupRouter);

  return httpServer;
}
