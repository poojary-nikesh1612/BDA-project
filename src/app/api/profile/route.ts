import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AppError,
  handleApiError,
  requireAuth,
} from "@/lib/api-helpers";
import { normalizeUsername, usernameSchema } from "@/lib/auth";
import { UserModel } from "@/models/User";
import { WorkspaceModel } from "@/models/Workspace";
import { DatasetModel } from "@/models/Dataset";
import { WeatherRecordModel } from "@/models/WeatherRecord";

const updateProfileSchema = z.object({
  username: usernameSchema,
});

export async function GET() {
  try {
    const user = await requireAuth();
    const [workspaceCount, datasetCount, recordCount] = await Promise.all([
      WorkspaceModel.countDocuments({ ownerId: user.id }),
      DatasetModel.countDocuments({ ownerId: user.id }),
      WeatherRecordModel.countDocuments({ ownerId: user.id }),
    ]);

    return NextResponse.json({
      profile: {
        id: user.id,
        username: user.username,
        normalizedUsername: user.normalizedUsername,
        createdAt: user.createdAt,
        workspaceCount,
        datasetCount,
        recordCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const parsed = updateProfileSchema.parse(body);
    const normalized = normalizeUsername(parsed.username);

    const existing = await UserModel.findOne({
      normalizedUsername: normalized,
      _id: { $ne: user.id },
    }).lean();

    if (existing) {
      throw new AppError(
        "That username is already in use by another account.",
        409,
        "USERNAME_TAKEN"
      );
    }

    const updated = await UserModel.findByIdAndUpdate(
      user.id,
      {
        $set: {
          username: parsed.username.trim(),
          normalizedUsername: normalized,
        },
      },
      { new: true }
    );

    if (!updated) {
      throw new AppError("User account not found.", 404, "NOT_FOUND");
    }

    return NextResponse.json({
      profile: {
        id: String(updated._id),
        username: updated.username,
        normalizedUsername: updated.normalizedUsername,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

