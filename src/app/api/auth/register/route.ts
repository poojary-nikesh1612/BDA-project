import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import {
  createSessionForUser,
  hashPassword,
  normalizeUsername,
  registerSchema,
  setSessionCookie,
} from "@/lib/auth";
import { AppError, handleApiError } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/utils";
import { UserModel } from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "anonymous";
    const rate = checkRateLimit(`register:${ip}`, 10, 60 * 1000);
    if (!rate.allowed) {
      throw new AppError(
        `Too many registration attempts. Please try again in ${rate.retryAfterSeconds} seconds.`,
        429,
        "RATE_LIMITED"
      );
    }

    await connectToDatabase();
    const body = await request.json();
    const parsed = registerSchema.parse(body);

    const normalizedUsername = normalizeUsername(parsed.username);
    const existing = await UserModel.findOne({ normalizedUsername }).lean();
    if (existing) {
      throw new AppError(
        "This username is already registered. Please choose another username or log in.",
        409,
        "USERNAME_TAKEN"
      );
    }

    const passwordHash = await hashPassword(parsed.password);
    const user = await UserModel.create({
      username: parsed.username.trim(),
      normalizedUsername,
      passwordHash,
    });

    const { token, expiresAt } = await createSessionForUser(String(user._id));
    setSessionCookie(token, expiresAt);

    return NextResponse.json(
      {
        user: {
          id: String(user._id),
          username: user.username,
          normalizedUsername: user.normalizedUsername,
          createdAt: user.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

