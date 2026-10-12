import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AppError,
  getOwnedDataset,
  getOwnedRecord,
  handleApiError,
  requireAuth,
} from "@/lib/api-helpers";
import { buildRecordDedupeKey } from "@/lib/csv-validator";
import { recalculateDatasetMetadata } from "@/lib/analytics-service";
import { WeatherRecordModel } from "@/models/WeatherRecord";

const updateRecordSchema = z.object({
  timestamp: z.string().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  temperature: z.number().nullable().optional(),
  humidity: z.number().nullable().optional(),
  rainfall: z.number().nullable().optional(),
  windSpeed: z.number().nullable().optional(),
  weatherCondition: z.string().trim().max(100).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { datasetId: string; recordId: string } }
) {
  try {
    const user = await requireAuth();
    const dataset = await getOwnedDataset(params.datasetId, user.id);
    const record = await getOwnedRecord(
      params.datasetId,
      params.recordId,
      user.id
    );

    const body = await request.json();
    const parsed = updateRecordSchema.parse(body);

    if (parsed.timestamp !== undefined) {
      const dt = new Date(parsed.timestamp);
      if (isNaN(dt.getTime())) {
        throw new AppError("Invalid timestamp format.", 400, "INVALID_DATE");
      }
      record.timestamp = dt;
    }

    if (parsed.city !== undefined) {
      record.city = parsed.city ? parsed.city.trim() : null;
    }
    if (parsed.temperature !== undefined) {
      record.temperature = parsed.temperature;
    }
    if (parsed.humidity !== undefined) {
      record.humidity = parsed.humidity;
    }
    if (parsed.rainfall !== undefined) {
      record.rainfall = parsed.rainfall;
    }
    if (parsed.windSpeed !== undefined) {
      record.windSpeed = parsed.windSpeed;
    }
    if (parsed.weatherCondition !== undefined) {
      record.weatherCondition = parsed.weatherCondition
        ? parsed.weatherCondition.trim()
        : null;
    }

    // Recompute dedupeKey and check for collision within dataset
    const newDedupeKey = buildRecordDedupeKey(record.timestamp, record.city, {
      temperature: record.temperature,
      humidity: record.humidity,
      rainfall: record.rainfall,
      windSpeed: record.windSpeed,
      weatherCondition: record.weatherCondition,
    });

    if (newDedupeKey !== record.dedupeKey) {
      const duplicate = await WeatherRecordModel.findOne({
        datasetId: dataset._id,
        dedupeKey: newDedupeKey,
        _id: { $ne: record._id },
      }).lean();

      if (duplicate) {
        throw new AppError(
          "Another observation in this dataset already has this timestamp and location.",
          409,
          "DUPLICATE_RECORD"
        );
      }
      record.dedupeKey = newDedupeKey;
    }

    // Update availableMetrics on dataset if user populated a measurement
    const metricSet = new Set(dataset.availableMetrics);
    if (record.temperature !== null && record.temperature !== undefined)
      metricSet.add("temperature");
    if (record.humidity !== null && record.humidity !== undefined)
      metricSet.add("humidity");
    if (record.rainfall !== null && record.rainfall !== undefined)
      metricSet.add("rainfall");
    if (record.windSpeed !== null && record.windSpeed !== undefined)
      metricSet.add("windSpeed");
    if (record.weatherCondition) metricSet.add("weatherCondition");
    dataset.availableMetrics = Array.from(metricSet);
    await dataset.save();

    await record.save();
    await recalculateDatasetMetadata(dataset._id);

    return NextResponse.json({
      record: {
        ...record.toObject(),
        _id: String(record._id),
        datasetId: String(record.datasetId),
        workspaceId: String(record.workspaceId),
        ownerId: String(record.ownerId),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { datasetId: string; recordId: string } }
) {
  try {
    const user = await requireAuth();
    const dataset = await getOwnedDataset(params.datasetId, user.id);
    const record = await getOwnedRecord(
      params.datasetId,
      params.recordId,
      user.id
    );

    await WeatherRecordModel.deleteOne({
      _id: record._id,
      datasetId: dataset._id,
      ownerId: user.id,
    });

    await recalculateDatasetMetadata(dataset._id);

    return NextResponse.json({
      success: true,
      deletedRecordId: String(record._id),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

