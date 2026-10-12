import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getOwnedDataset,
  handleApiError,
  requireAuth,
} from "@/lib/api-helpers";
import { getDatasetQualityAnalysis } from "@/lib/analytics-service";

const qualityQuerySchema = z.object({
  issueType: z
    .enum([
      "all",
      "missing_value",
      "out_of_range",
      "inconsistent_category",
      "unexpected_condition",
    ])
    .optional()
    .default("all"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const user = await requireAuth();
    const dataset = await getOwnedDataset(params.datasetId, user.id);
    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const parsed = qualityQuerySchema.parse(searchParams);

    const quality = await getDatasetQualityAnalysis(dataset, parsed.issueType);
    return NextResponse.json({ quality });
  } catch (error) {
    return handleApiError(error);
  }
}

