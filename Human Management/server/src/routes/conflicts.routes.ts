import { Router } from "express";
import { getConflictsByDateHandler } from "../controllers/conflicts.controller";

export const conflictsRouter = Router();

conflictsRouter.post("/by-date", getConflictsByDateHandler);
