import { Router } from "express";
import * as vehiclesController from "../controllers/vehicles.controller";

export const vehiclesRouter = Router();

vehiclesRouter.get("/", vehiclesController.listVehicles);
vehiclesRouter.post("/", vehiclesController.createVehicle);
vehiclesRouter.get("/:id", vehiclesController.getVehicle);
vehiclesRouter.patch("/:id", vehiclesController.updateVehicle);
vehiclesRouter.delete("/:id", vehiclesController.deleteVehicle);
