import { Router } from "express";
import * as jobsController from "../controllers/jobs.controller";
import * as attachmentsController from "../controllers/attachments.controller";
import { upload } from "../lib/uploads";

export const jobsRouter = Router();

jobsRouter.get("/", jobsController.listJobs);
jobsRouter.post("/", jobsController.createJob);
jobsRouter.get("/:id", jobsController.getJob);
jobsRouter.patch("/:id", jobsController.updateJob);
jobsRouter.delete("/:id", jobsController.deleteJob);

jobsRouter.get("/:jobId/attachments", attachmentsController.listAttachments);
jobsRouter.post("/:jobId/attachments", upload.single("file"), attachmentsController.uploadAttachment);
