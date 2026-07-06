import { Router } from "express";
import * as staffController from "../controllers/staff.controller";

export const staffRouter = Router();

staffRouter.get("/", staffController.listStaff);
staffRouter.post("/", staffController.createStaff);
staffRouter.post("/bulk", staffController.createManyStaff);
staffRouter.get("/:id", staffController.getStaff);
staffRouter.patch("/:id", staffController.updateStaff);
staffRouter.delete("/:id", staffController.deleteStaff);
