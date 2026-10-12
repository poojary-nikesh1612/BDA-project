import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import {
  createSessionForUser,
  loginSchema,
  normalizeUsername,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { AppError, handleApiError } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/utils";
import { UserModel } from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "anonymous";
    const rate = checkRateLimit(`login:${ip}`, 15, 60 * 1000);
    if (!rate.allowed) {
      throw new AppError(
        `Too many login attempts. Please try again in ${rate.retryAfterSeconds} seconds.`,
        429,
        "RATE_LIMITED"
      );
    }

    await connectToDatabase();
    const body = await request.json();
    const parsed = loginSchema.parse(body);

    const normalizedUsername = normalizeUsername(parsed.username);
    const user = await UserModel.findOne({ normalizedUsername });

    if (!user) {
      throw new AppError(
        "Invalid username or password.",
        401,
        "INVALID_CREDENTIALS"
      );
    }

    const isValid = await verifyPassword(parsed.password, user.passwordHash);
    if (!isValid) {
      throw new AppError(
        "Invalid username or password.",
        401,
        "INVALID_CREDENTIALS"
      );
    }

    const { token, expiresAt } = await createSessionForUser(String(user._id));
    setSessionCookie(token, expiresAt);

    return NextResponse.json({
      user: {
        id: String(user._id),
        username: user.username,
        normalizedUsername: user.normalizedUsername,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

