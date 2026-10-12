import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AppError,
  getOwnedDataset,
  handleApiError,
  requireAuth,
} from "@/lib/api-helpers";
import {
  MAX_CSV_FILE_SIZE_BYTES,
  parseAndValidateWeatherCsv,
} from "@/lib/csv-validator";
import { checkRateLimit } from "@/lib/utils";
import { ColumnMapping } from "@/models/Dataset";
import { WeatherRecordModel } from "@/models/WeatherRecord";
import { recalculateDatasetMetadata } from "@/lib/analytics-service";

const columnMappingSchema = z.object({
  timestamp: z.string().min(1, "Timestamp column mapping is required"),
  city: z.string().optional(),
  temperature: z.string().optional(),
  humidity: z.string().optional(),
  rainfall: z.string().optional(),
  windSpeed: z.string().optional(),
  weatherCondition: z.string().optional(),
});

const BATCH_SIZE = 500;

export async function POST(
  request: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const user = await requireAuth();
    const rate = checkRateLimit(`import:${user.id}`, 10, 60 * 1000);
    if (!rate.allowed) {
      throw new AppError(
        `Too many dataset imports. Please wait ${rate.retryAfterSeconds} seconds.`,
        429,
        "RATE_LIMITED"
      );
    }

    const dataset = await getOwnedDataset(params.datasetId, user.id);

    let csvContent = "";
    let columnMapping: ColumnMapping = {};
    let defaultCity = "";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const mappingRaw = formData.get("columnMapping");
      const defaultCityRaw = formData.get("defaultCity");

      if (!file || !(file instanceof File)) {
        throw new AppError("A valid CSV file is required.", 400, "MISSING_FILE");
      }
      if (file.size === 0) {
        throw new AppError("Uploaded CSV file is empty.", 400, "EMPTY_FILE");
      }
      if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
        throw new AppError(
          "CSV file exceeds the 15 MB size limit.",
          400,
          "FILE_TOO_LARGE"
        );
      }

      csvContent = await file.text();
      if (typeof mappingRaw === "string" && mappingRaw.trim()) {
        columnMapping = columnMappingSchema.parse(JSON.parse(mappingRaw));
      } else {
        throw new AppError(
          "Column mapping is required.",
          400,
          "MISSING_MAPPING"
        );
      }
      if (typeof defaultCityRaw === "string") {
        defaultCity = defaultCityRaw.trim();
      }
    } else {
      const body = await request.json();
      const schema = z.object({
        csvContent: z.string().min(1, "CSV content cannot be empty"),
        columnMapping: columnMappingSchema,
        defaultCity: z.string().optional().default(""),
      });
      const parsed = schema.parse(body);
      if (Buffer.byteLength(parsed.csvContent, "utf8") > MAX_CSV_FILE_SIZE_BYTES) {
        throw new AppError(
          "CSV content exceeds the 15 MB size limit.",
          400,
          "FILE_TOO_LARGE"
        );
      }
      csvContent = parsed.csvContent;
      columnMapping = parsed.columnMapping;
      defaultCity = parsed.defaultCity;
    }

    if (!csvContent.trim() || csvContent.includes("\0")) {
      throw new AppError(
        "File does not appear to be valid text CSV data.",
        400,
        "INVALID_CSV_CONTENT"
      );
    }

    const validation = parseAndValidateWeatherCsv(csvContent, columnMapping, {
      defaultCity,
      includeValidRecords: true,
    });

    if (validation.validRecords.length === 0) {
      dataset.importStatus = "failed";
      dataset.rowCount = validation.totalRows;
      dataset.invalidRowCount = validation.invalidRows;
      dataset.duplicateRowCount = validation.duplicateRows;
      dataset.warningCount = validation.warningCount;
      dataset.importIssuePreview = validation.issuesPreview.slice(0, 100);
      await dataset.save();

      throw new AppError(
        "No valid weather records could be imported from this CSV file. Inspect the validation report for details.",
        400,
        "NO_VALID_RECORDS"
      );
    }

    dataset.importStatus = "importing";
    await dataset.save();

    let insertedCount = 0;
    let upsertedOrExistingDuplicates = 0;

    try {
      const records = validation.validRecords;
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const chunk = records.slice(i, i + BATCH_SIZE);
        const operations = chunk.map((rec) => ({
          updateOne: {
            filter: {
              datasetId: dataset._id,
              dedupeKey: rec.dedupeKey,
            },
            update: {
              $setOnInsert: {
                datasetId: dataset._id,
                workspaceId: dataset.workspaceId,
                ownerId: dataset.ownerId,
                timestamp: rec.timestamp,
                city: rec.city,
                temperature: rec.temperature,
                humidity: rec.humidity,
                rainfall: rec.rainfall,
                windSpeed: rec.windSpeed,
                weatherCondition: rec.weatherCondition,
                rawRowNumber: rec.rawRowNumber,
                dedupeKey: rec.dedupeKey,
              },
            },
            upsert: true,
          },
        }));

        const bulkResult = await WeatherRecordModel.bulkWrite(operations, {
          ordered: false,
        });
        insertedCount += bulkResult.upsertedCount;
        upsertedOrExistingDuplicates += chunk.length - bulkResult.upsertedCount;
      }

      const totalDuplicatesSkipped =
        validation.duplicateRows + upsertedOrExistingDuplicates;

      dataset.columns = validation.headers;
      dataset.columnMapping = columnMapping;
      dataset.defaultCity = defaultCity || undefined;
      dataset.availableMetrics = validation.availableMetrics;
      dataset.rowCount = validation.totalRows;
      dataset.invalidRowCount = validation.invalidRows;
      dataset.duplicateRowCount = totalDuplicatesSkipped;
      dataset.warningCount = validation.warningCount;
      dataset.importStatus = "completed";
      dataset.importIssuePreview = validation.issuesPreview.slice(0, 100);
      await dataset.save();

      const updatedDataset = await recalculateDatasetMetadata(dataset._id);

      return NextResponse.json({
        importSummary: {
          datasetId: String(dataset._id),
          totalParsedRows: validation.totalRows,
          insertedCount,
          skippedDuplicateCount: totalDuplicatesSkipped,
          failedInvalidCount: validation.invalidRows,
          warningCount: validation.warningCount,
          storedValidRecordCount:
            updatedDataset?.validRowCount ?? insertedCount,
          dateRangeStart: updatedDataset?.dateRangeStart ?? validation.dateRangeStart,
          dateRangeEnd: updatedDataset?.dateRangeEnd ?? validation.dateRangeEnd,
        },
        dataset: updatedDataset
          ? {
              ...updatedDataset.toObject(),
              _id: String(updatedDataset._id),
              workspaceId: String(updatedDataset.workspaceId),
              ownerId: String(updatedDataset.ownerId),
            }
          : null,
      });
    } catch (dbErr) {
      dataset.importStatus = "failed";
      await dataset.save();
      throw dbErr;
    }
  } catch (error) {
    if (error instanceof Error && !(error instanceof AppError)) {
      if (
        error.message.includes("column") ||
        error.message.includes("CSV") ||
        error.message.includes("mapped")
      ) {
        return handleApiError(new AppError(error.message, 400, "CSV_INVALID"));
      }
    }
    return handleApiError(error);
  }
}

