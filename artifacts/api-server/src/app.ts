import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Root route for debugging
app.get("/", (req, res) => {
  res.json({
    message: "Walk With Me API Server",
    status: "running",
    endpoints: {
      health: "/api/health",
      status: "/api/status",
      presence: "/api/presence",
      walk_pos: "/api/walk-pos",
      messages: "/api/messages"
    },
    timestamp: new Date().toISOString()
  });
});

export default app;
