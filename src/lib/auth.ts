import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { z } from "zod";
import { getServerEnv } from "./env";
import { connectToDatabase } from "./db";
import { UserModel } from "@/models/User";
import { SessionModel } from "@/models/Session";

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    "Username can only contain letters, numbers, underscores, dots, and hyphens"
  );

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const registerSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function isSessionExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  normalizedUsername: string;
  createdAt: Date;
}

export async function createSessionForUser(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  await connectToDatabase();
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await SessionModel.create({
    userId,
    tokenHash,
    expiresAt,
  });

  return { token, expiresAt };
}

export function setSessionCookie(token: string, expiresAt: Date): void {
  const env = getServerEnv();
  const cookieStore = cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(): void {
  const env = getServerEnv();
  const cookieStore = cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function invalidateCurrentSession(): Promise<void> {
  const env = getServerEnv();
  const cookieStore = cookies();
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (token) {
    try {
      await connectToDatabase();
      const tokenHash = hashSessionToken(token);
      await SessionModel.deleteOne({ tokenHash });
    } catch {
      // Ignore DB errors during logout cleanup so cookie is still cleared
    }
  }

  clearSessionCookie();
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const env = getServerEnv();
  const cookieStore = cookies();
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (!token || token.length < 32) {
    return null;
  }

  await connectToDatabase();
  const tokenHash = hashSessionToken(token);
  const session = await SessionModel.findOne({ tokenHash }).lean();

  if (!session) {
    return null;
  }

  if (isSessionExpired(new Date(session.expiresAt))) {
    await SessionModel.deleteOne({ _id: session._id });
    return null;
  }

  const user = await UserModel.findById(session.userId)
    .select("_id username normalizedUsername createdAt")
    .lean();

  if (!user) {
    return null;
  }

  return {
    id: String(user._id),
    username: user.username,
    normalizedUsername: user.normalizedUsername,
    createdAt: user.createdAt,
  };
}

