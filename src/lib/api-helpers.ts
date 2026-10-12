import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  DatabaseConfigurationError,
  DatabaseConnectionError,
  connectToDatabase,
} from "./db";
import { getCurrentUser, AuthenticatedUser } from "./auth";
import { isValidObjectId } from "./utils";
import { WorkspaceModel, IWorkspace } from "@/models/Workspace";
import { DatasetModel, IDataset } from "@/models/Dataset";
import { WeatherRecordModel, IWeatherRecord } from "@/models/WeatherRecord";

export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function verifyResourceOwnership(
  resourceOwnerId: string | { toString(): string },
  currentUserId: string
): boolean {
  return String(resourceOwnerId) === String(currentUserId);
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  await connectToDatabase();
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("Authentication required. Please log in.", 401, "UNAUTHORIZED");
  }
  return user;
}

export async function getOwnedWorkspace(
  workspaceId: string,
  userId: string
): Promise<IWorkspace> {
  if (!isValidObjectId(workspaceId)) {
    throw new AppError("Invalid workspace ID.", 400, "INVALID_ID");
  }
  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace || !verifyResourceOwnership(workspace.ownerId, userId)) {
    throw new AppError("Workspace not found.", 404, "NOT_FOUND");
  }
  return workspace;
}

export async function getOwnedDataset(
  datasetId: string,
  userId: string
): Promise<IDataset> {
  if (!isValidObjectId(datasetId)) {
    throw new AppError("Invalid dataset ID.", 400, "INVALID_ID");
  }
  const dataset = await DatasetModel.findById(datasetId);
  if (!dataset || !verifyResourceOwnership(dataset.ownerId, userId)) {
    throw new AppError("Dataset not found.", 404, "NOT_FOUND");
  }
  return dataset;
}

export async function getOwnedRecord(
  datasetId: string,
  recordId: string,
  userId: string
): Promise<IWeatherRecord> {
  if (!isValidObjectId(datasetId) || !isValidObjectId(recordId)) {
    throw new AppError("Invalid record or dataset ID.", 400, "INVALID_ID");
  }
  const record = await WeatherRecordModel.findOne({
    _id: recordId,
    datasetId,
  });
  if (!record || !verifyResourceOwnership(record.ownerId, userId)) {
    throw new AppError("Weather record not found.", 404, "NOT_FOUND");
  }
  return record;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof DatabaseConfigurationError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "DB_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  if (error instanceof DatabaseConnectionError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "DB_CONNECTION_ERROR",
      },
      { status: 503 }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return NextResponse.json(
      {
        error: firstIssue
          ? `${firstIssue.path.join(".") ? `${firstIssue.path.join(".")}: ` : ""}${firstIssue.message}`
          : "Validation error",
        code: "VALIDATION_ERROR",
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      error: "An unexpected server error occurred.",
      code: "INTERNAL_ERROR",
    },
    { status: 500 }
  );
}

