import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  const explicitOrigin = process.env.CLIENT_ORIGIN;
  app.use(
    cors({
      origin: explicitOrigin ?? /^http:\/\/localhost:\d+$/,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.use("/api", apiRouter);

  app.use(errorHandler);

  return app;
}
