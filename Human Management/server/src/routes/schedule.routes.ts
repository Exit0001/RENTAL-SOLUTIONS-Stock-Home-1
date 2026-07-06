import { Router } from "express";
import { getScheduleHandler } from "../controllers/schedule.controller";

export const scheduleRouter = Router();

scheduleRouter.get("/", getScheduleHandler);
