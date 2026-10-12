import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import mongoose from "mongoose";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

export function formatDateTime(
  date: Date | string | null | undefined,
  includeTime = true
): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid Date";
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }
      : {}),
  }).format(d);
}

export function formatNumber(
  value: number | null | undefined,
  decimals = 1,
  unit = ""
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  const formatted = Number(value).toFixed(decimals);
  return unit ? `${formatted} ${unit}` : formatted;
}

// Simple in-memory rate limiter for authentication & heavy import routes
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: 0,
  };
}

