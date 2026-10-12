import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AppError,
  getOwnedDataset,
  handleApiError,
  requireAuth,
} from "@/lib/api-helpers";
import {
  buildMatchFilter,
  recalculateDatasetMetadata,
  recordQuerySchema,
} from "@/lib/analytics-service";
import { buildRecordDedupeKey } from "@/lib/csv-validator";
import { WeatherRecordModel } from "@/models/WeatherRecord";

const createRecordSchema = z.object({
  timestamp: z.string().min(1, "Timestamp is required"),
  city: z.string().trim().max(120).nullable().optional(),
  temperature: z.number().nullable().optional(),
  humidity: z.number().nullable().optional(),
  rainfall: z.number().nullable().optional(),
  windSpeed: z.number().nullable().optional(),
  weatherCondition: z.string().trim().max(100).nullable().optional(),
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
    const query = recordQuerySchema.parse(searchParams);

    const match = buildMatchFilter(dataset._id, user.id, query);
    const sortDirection = query.sortOrder === "asc" ? 1 : -1;
    const sortStage: Record<string, 1 | -1> = {
      [query.sortBy]: sortDirection,
      _id: 1,
    };

    const skip = (query.page - 1) * query.limit;

    const [records, totalCount, distinctCities, distinctConditions] =
      await Promise.all([
        WeatherRecordModel.find(match)
          .sort(sortStage)
          .skip(skip)
          .limit(query.limit)
          .lean(),
        WeatherRecordModel.countDocuments(match),
        WeatherRecordModel.distinct("city", {
          datasetId: dataset._id,
          ownerId: user.id,
          city: { $nin: [null, ""] },
        }),
        WeatherRecordModel.distinct("weatherCondition", {
          datasetId: dataset._id,
          ownerId: user.id,
          weatherCondition: { $nin: [null, ""] },
        }),
      ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / query.limit));

    return NextResponse.json({
      records: records.map((r) => ({
        ...r,
        _id: String(r._id),
        datasetId: String(r.datasetId),
        workspaceId: String(r.workspaceId),
        ownerId: String(r.ownerId),
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages,
      },
      filterOptions: {
        cities: (distinctCities as string[]).filter(Boolean).sort(),
        weatherConditions: (distinctConditions as string[])
          .filter(Boolean)
          .sort(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const user = await requireAuth();
    const dataset = await getOwnedDataset(params.datasetId, user.id);
    const body = await request.json();
    const parsed = createRecordSchema.parse(body);

    const parsedDate = new Date(parsed.timestamp);
    if (isNaN(parsedDate.getTime())) {
      throw new AppError("Invalid timestamp.", 400, "INVALID_TIMESTAMP");
    }

    const dedupeKey = buildRecordDedupeKey(parsedDate, parsed.city ?? null, {
      temperature: parsed.temperature ?? null,
      humidity: parsed.humidity ?? null,
      rainfall: parsed.rainfall ?? null,
      windSpeed: parsed.windSpeed ?? null,
      weatherCondition: parsed.weatherCondition ?? null,
    });

    const existing = await WeatherRecordModel.findOne({
      datasetId: dataset._id,
      dedupeKey,
    }).lean();
    if (existing) {
      throw new AppError(
        "A weather observation with the same timestamp and location already exists in this dataset.",
        409,
        "DUPLICATE_RECORD"
      );
    }

    const lastRow = await WeatherRecordModel.findOne({
      datasetId: dataset._id,
    })
      .sort({ rawRowNumber: -1 })
      .select("rawRowNumber")
      .lean();

    const nextRowNumber = (lastRow?.rawRowNumber ?? dataset.rowCount) + 1;

    const record = await WeatherRecordModel.create({
      datasetId: dataset._id,
      workspaceId: dataset.workspaceId,
      ownerId: user.id,
      timestamp: parsedDate,
      city: parsed.city?.trim() || null,
      temperature: parsed.temperature ?? null,
      humidity: parsed.humidity ?? null,
      rainfall: parsed.rainfall ?? null,
      windSpeed: parsed.windSpeed ?? null,
      weatherCondition: parsed.weatherCondition?.trim() || null,
      rawRowNumber: nextRowNumber,
      dedupeKey,
    });

    await recalculateDatasetMetadata(dataset._id);

    return NextResponse.json(
      {
        record: {
          ...record.toObject(),
          _id: String(record._id),
          datasetId: String(record.datasetId),
          workspaceId: String(record.workspaceId),
          ownerId: String(record.ownerId),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

