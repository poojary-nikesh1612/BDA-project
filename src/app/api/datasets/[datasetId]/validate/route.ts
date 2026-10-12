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
import { ColumnMapping } from "@/models/Dataset";

const columnMappingSchema = z.object({
  timestamp: z.string().min(1, "Timestamp column mapping is required"),
  city: z.string().optional(),
  temperature: z.string().optional(),
  humidity: z.string().optional(),
  rainfall: z.string().optional(),
  windSpeed: z.string().optional(),
  weatherCondition: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const user = await requireAuth();
    await getOwnedDataset(params.datasetId, user.id);

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
      includeValidRecords: false,
    });

    return NextResponse.json({
      validation: {
        totalRows: validation.totalRows,
        validRows: validation.validRows,
        invalidRows: validation.invalidRows,
        duplicateRows: validation.duplicateRows,
        warningCount: validation.warningCount,
        missingValueCount: validation.missingValueCount,
        headers: validation.headers,
        availableMetrics: validation.availableMetrics,
        dateRangeStart: validation.dateRangeStart,
        dateRangeEnd: validation.dateRangeEnd,
        issuesPreview: validation.issuesPreview,
        columnQuality: validation.columnQuality,
      },
    });
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

