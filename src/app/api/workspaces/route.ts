import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { WorkspaceModel } from "@/models/Workspace";
import { DatasetModel } from "@/models/Dataset";

const workspacePayloadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Workspace name is required")
    .max(100, "Workspace name cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .default(""),
});

export async function GET() {
  try {
    const user = await requireAuth();
    const ownerObjectId = new mongoose.Types.ObjectId(user.id);

    const [workspaces, datasetCounts] = await Promise.all([
      WorkspaceModel.find({ ownerId: ownerObjectId })
        .sort({ createdAt: -1 })
        .lean(),
      DatasetModel.aggregate([
        { $match: { ownerId: ownerObjectId } },
        {
          $group: {
            _id: "$workspaceId",
            datasetCount: { $sum: 1 },
            totalRecords: { $sum: "$validRowCount" },
          },
        },
      ]),
    ]);

    const countMap = new Map<
      string,
      { datasetCount: number; totalRecords: number }
    >();
    for (const item of datasetCounts) {
      countMap.set(String(item._id), {
        datasetCount: item.datasetCount,
        totalRecords: item.totalRecords,
      });
    }

    const enriched = workspaces.map((ws) => {
      const stats = countMap.get(String(ws._id)) ?? {
        datasetCount: 0,
        totalRecords: 0,
      };
      return {
        _id: String(ws._id),
        name: ws.name,
        description: ws.description,
        ownerId: String(ws.ownerId),
        datasetCount: stats.datasetCount,
        totalRecords: stats.totalRecords,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
      };
    });

    return NextResponse.json({ workspaces: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const parsed = workspacePayloadSchema.parse(body);

    const workspace = await WorkspaceModel.create({
      name: parsed.name,
      description: parsed.description,
      ownerId: user.id,
    });

    return NextResponse.json(
      {
        workspace: {
          _id: String(workspace._id),
          name: workspace.name,
          description: workspace.description,
          ownerId: String(workspace.ownerId),
          datasetCount: 0,
          totalRecords: 0,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

