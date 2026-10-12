import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getOwnedDataset,
  handleApiError,
  requireAuth,
} from "@/lib/api-helpers";
import { DatasetModel } from "@/models/Dataset";
import { WeatherRecordModel } from "@/models/WeatherRecord";
import { WorkspaceModel } from "@/models/Workspace";

const updateDatasetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dataset name is required")
    .max(120, "Dataset name cannot exceed 120 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const user = await requireAuth();
    const dataset = await getOwnedDataset(params.datasetId, user.id);
    const workspace = await WorkspaceModel.findOne({
      _id: dataset.workspaceId,
      ownerId: user.id,
    }).lean();

    return NextResponse.json({
      dataset: {
        ...dataset.toObject(),
        _id: String(dataset._id),
        workspaceId: String(dataset.workspaceId),
        ownerId: String(dataset.ownerId),
      },
      workspace: workspace
        ? {
            _id: String(workspace._id),
            name: workspace.name,
            description: workspace.description,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const user = await requireAuth();
    const dataset = await getOwnedDataset(params.datasetId, user.id);
    const body = await request.json();
    const parsed = updateDatasetSchema.parse(body);

    if (parsed.name !== undefined) dataset.name = parsed.name;
    if (parsed.description !== undefined)
      dataset.description = parsed.description;

    await dataset.save();

    return NextResponse.json({
      dataset: {
        ...dataset.toObject(),
        _id: String(dataset._id),
        workspaceId: String(dataset.workspaceId),
        ownerId: String(dataset.ownerId),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const user = await requireAuth();
    const dataset = await getOwnedDataset(params.datasetId, user.id);

    await WeatherRecordModel.deleteMany({
      datasetId: dataset._id,
      ownerId: user.id,
    });
    await DatasetModel.deleteOne({
      _id: dataset._id,
      ownerId: user.id,
    });

    return NextResponse.json({
      success: true,
      deletedDatasetId: String(dataset._id),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

