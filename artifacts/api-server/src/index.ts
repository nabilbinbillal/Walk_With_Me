import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  logger.info("New WebSocket connection");

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Broadcast movement to everyone EXCEPT the sender
      if (message.type === "walk-pos") {
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
          }
        });
      }
    } catch (err) {
      logger.error({ err }, "Error parsing WS message");
    }
  });

  ws.on("error", (err) => {
    logger.error({ err }, "WS error");
  });

  ws.on("close", () => {
    logger.info("WS connection closed");
  });
});

server.listen(port, () => {
  logger.info({ port }, "Server listening with WebSockets");
});
