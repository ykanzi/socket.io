import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
};
