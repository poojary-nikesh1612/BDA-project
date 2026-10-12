import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getOwnedWorkspace,
  handleApiError,
  requireAuth,
} from "@/lib/api-helpers";
import { DatasetModel } from "@/models/Dataset";
import { WeatherRecordModel } from "@/models/WeatherRecord";
import { WorkspaceModel } from "@/models/Workspace";

const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Workspace name is required")
    .max(100, "Workspace name cannot exceed 100 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),
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
      workspace: {
        _id: String(workspace._id),
        name: workspace.name,
        description: workspace.description,
        ownerId: String(workspace.ownerId),
        datasetCount: datasets.length,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const user = await requireAuth();
    const workspace = await getOwnedWorkspace(params.workspaceId, user.id);
    const body = await request.json();
    const parsed = updateWorkspaceSchema.parse(body);

    if (parsed.name !== undefined) workspace.name = parsed.name;
    if (parsed.description !== undefined)
      workspace.description = parsed.description;

    await workspace.save();

    return NextResponse.json({
      workspace: {
        _id: String(workspace._id),
        name: workspace.name,
        description: workspace.description,
        ownerId: String(workspace.ownerId),
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const user = await requireAuth();
    const workspace = await getOwnedWorkspace(params.workspaceId, user.id);

    // Delete associated weather records first, then datasets, then workspace
    await WeatherRecordModel.deleteMany({
      workspaceId: workspace._id,
      ownerId: user.id,
    });
    await DatasetModel.deleteMany({
      workspaceId: workspace._id,
      ownerId: user.id,
    });
    await WorkspaceModel.deleteOne({
      _id: workspace._id,
      ownerId: user.id,
    });

    return NextResponse.json({
      success: true,
      deletedWorkspaceId: String(workspace._id),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

