import { Router } from "express";
import * as attachmentsController from "../controllers/attachments.controller";

export const attachmentsRouter = Router();

attachmentsRouter.get("/:id/download", attachmentsController.downloadAttachment);
attachmentsRouter.delete("/:id", attachmentsController.deleteAttachment);
