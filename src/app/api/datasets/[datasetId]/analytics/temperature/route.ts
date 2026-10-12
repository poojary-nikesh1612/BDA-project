import { NextRequest, NextResponse } from "next/server";
import {
  getOwnedDataset,
  handleApiError,
  requireAuth,
} from "@/lib/api-helpers";
import {
  analyticsFilterSchema,
  getTemperatureTrends,
} from "@/lib/analytics-service";

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
    const filters = analyticsFilterSchema.parse(searchParams);

    const temperature = await getTemperatureTrends(dataset, filters);
    return NextResponse.json({ temperature });
  } catch (error) {
    return handleApiError(error);
  }
}

