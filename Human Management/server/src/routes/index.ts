import { Router } from "express";
import { staffRouter } from "./staff.routes";
import { vehiclesRouter } from "./vehicles.routes";
import { jobsRouter } from "./jobs.routes";
import { conflictsRouter } from "./conflicts.routes";
import { dashboardRouter } from "./dashboard.routes";
import { scheduleRouter } from "./schedule.routes";
import { attachmentsRouter } from "./attachments.routes";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

apiRouter.use("/staff", staffRouter);
apiRouter.use("/vehicles", vehiclesRouter);
apiRouter.use("/jobs", jobsRouter);
apiRouter.use("/conflicts", conflictsRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/schedule", scheduleRouter);
apiRouter.use("/attachments", attachmentsRouter);
