import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().optional().default(""),
  MONGODB_DB_NAME: z.string().min(1).default("weatherAnalyzer"),
  SESSION_COOKIE_NAME: z.string().min(1).default("weather_analyzer_session"),
  APP_TIMEZONE: z.string().min(1).default("Asia/Kolkata"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function getServerEnv(): ServerEnv {
  const parsed = envSchema.safeParse({
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || "weatherAnalyzer",
    SESSION_COOKIE_NAME:
      process.env.SESSION_COOKIE_NAME || "weather_analyzer_session",
    APP_TIMEZONE: process.env.APP_TIMEZONE || "Asia/Kolkata",
    NODE_ENV: process.env.NODE_ENV || "development",
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment configuration: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ")}`
    );
  }

  return parsed.data;
}

export function isDatabaseConfigured(): boolean {
  const env = getServerEnv();
  const uri = env.MONGODB_URI.trim();
  return (
    uri.length > 0 &&
    (uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://"))
  );
}

