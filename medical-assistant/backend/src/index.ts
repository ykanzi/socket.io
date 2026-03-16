import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { config } from "./config";
import chatRouter from "./routes/chat";
import patientRouter from "./routes/patient";
import { streamChat, PatientContext } from "./services/ai";

const app = express();
const httpServer = createServer(app);

// Socket.IO pour le chat temps reel
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.frontendUrl,
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// Routes REST
app.use("/api/chat", chatRouter);
app.use("/api/patients", patientRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "0.1.0",
    service: "medical-assistant-api",
  });
});

// Socket.IO - Chat temps reel avec streaming
io.on("connection", (socket) => {
  console.log(`Client connecte: ${socket.id}`);

  socket.on(
    "chat:message",
    async (data: {
      message: string;
      conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
      patient?: PatientContext;
    }) => {
      try {
        const response = await streamChat(
          data.message,
          data.conversationHistory || [],
          data.patient,
          (chunk) => {
            socket.emit("chat:stream", { chunk });
          }
        );

        socket.emit("chat:response", { data: response });
      } catch (error) {
        console.error("Erreur Socket.IO chat:", error);
        socket.emit("chat:error", {
          message: "Une erreur est survenue. Veuillez reessayer.",
        });
      }
    }
  );

  socket.on("disconnect", () => {
    console.log(`Client deconnecte: ${socket.id}`);
  });
});

// Demarrage
httpServer.listen(config.port, () => {
  console.log(`
  =============================================
    SantIA - Backend API
    Port: ${config.port}
    Env:  ${config.nodeEnv}
    URL:  http://localhost:${config.port}
  =============================================
  `);
});

export { app, httpServer, io };
