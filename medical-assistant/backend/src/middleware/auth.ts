import { Request, Response, NextFunction } from "express";

// MVP: Simple API key middleware
// TODO: Replace with NextAuth.js JWT validation
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip auth in development
  if (process.env.NODE_ENV === "development") {
    next();
    return;
  }

  const apiKey = req.headers["x-api-key"];
  if (!apiKey) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }

  // TODO: Validate against database
  next();
}
