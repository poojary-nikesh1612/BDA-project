import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getOwnedWorkspace,
  handleApiError,
  requireAuth,
} from "@/lib/api-helpers";
import { DatasetModel } from "@/models/Dataset";

const createDatasetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dataset name is required")
    .max(120, "Dataset name cannot exceed 120 characters"),
  originalFilename: z
    .string()
    .trim()
    .min(1, "Original filename is required")
    .max(255),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .default(""),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const user = await requireAuth();
    const workspace = await getOwnedWorkspace(params.workspaceId, user.id);

    const datasets = await DatasetModel.find({
      workspaceId: workspace._id,
      ownerId: user.id,
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      datasets: datasets.map((d) => ({
        ...d,
        _id: String(d._id),
        workspaceId: String(d.workspaceId),
        ownerId: String(d.ownerId),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const user = await requireAuth();
    const workspace = await getOwnedWorkspace(params.workspaceId, user.id);
    const body = await request.json();
    const parsed = createDatasetSchema.parse(body);

    const dataset = await DatasetModel.create({
      name: parsed.name,
      originalFilename: parsed.originalFilename,
      description: parsed.description,
      workspaceId: workspace._id,
      ownerId: user.id,
      importStatus: "pending",
    });

    return NextResponse.json(
      {
        dataset: {
          ...dataset.toObject(),
          _id: String(dataset._id),
          workspaceId: String(dataset.workspaceId),
          ownerId: String(dataset.ownerId),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

