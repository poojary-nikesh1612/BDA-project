import mongoose, { PipelineStage } from "mongoose";
import { z } from "zod";
import { getServerEnv } from "./env";
import {
  CANONICAL_CONDITION_MAP,
  DEFAULT_PLAUSIBLE_RANGES,
  normalizeWeatherConditionForAnalytics,
  PlausibleRanges,
  STANDARD_WEATHER_CONDITIONS,
} from "./csv-validator";
import { DatasetModel, IDataset } from "@/models/Dataset";
import { WeatherRecordModel, IWeatherRecord } from "@/models/WeatherRecord";

export const analyticsFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  city: z.string().optional(),
  weatherCondition: z.string().optional(),
  minTemp: z
    .string()
    .optional()
    .transform((v) => (v !== undefined && v.trim() !== "" ? Number(v) : undefined))
    .refine((v) => v === undefined || !Number.isNaN(v), {
      message: "minTemp must be a valid number",
    }),
  maxTemp: z
    .string()
    .optional()
    .transform((v) => (v !== undefined && v.trim() !== "" ? Number(v) : undefined))
    .refine((v) => v === undefined || !Number.isNaN(v), {
      message: "maxTemp must be a valid number",
    }),
  granularity: z.enum(["auto", "hourly", "daily", "monthly"]).optional().default("auto"),
});

export type AnalyticsFilters = z.infer<typeof analyticsFilterSchema>;

export const recordQuerySchema = analyticsFilterSchema.extend({
  search: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, parseInt(v, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) =>
      v ? Math.min(100, Math.max(1, parseInt(v, 10) || 25)) : 25
    ),
  sortBy: z.enum(["timestamp", "temperature", "rawRowNumber"]).optional().default("timestamp"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type RecordQueryFilters = z.infer<typeof recordQuerySchema>;

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildMatchFilter(
  datasetId: string | mongoose.Types.ObjectId,
  ownerId: string | mongoose.Types.ObjectId,
  filters: Partial<AnalyticsFilters & { search?: string }>
): Record<string, unknown> {
  const match: Record<string, unknown> = {
    datasetId: new mongoose.Types.ObjectId(String(datasetId)),
    ownerId: new mongoose.Types.ObjectId(String(ownerId)),
  };

  if (filters.startDate || filters.endDate) {
    const tsCond: Record<string, Date> = {};
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      if (!isNaN(start.getTime())) {
        tsCond.$gte = start;
      }
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      if (!isNaN(end.getTime())) {
        // If only YYYY-MM-DD was passed, include the full end day
        if (/^\d{4}-\d{2}-\d{2}$/.test(filters.endDate.trim())) {
          end.setUTCHours(23, 59, 59, 999);
        }
        tsCond.$lte = end;
      }
    }
    if (Object.keys(tsCond).length > 0) {
      match.timestamp = tsCond;
    }
  }

  if (filters.city && filters.city.trim() && filters.city !== "all") {
    match.city = {
      $regex: `^${escapeRegex(filters.city.trim())}$`,
      $options: "i",
    };
  } else if (filters.search && filters.search.trim()) {
    match.city = {
      $regex: escapeRegex(filters.search.trim()),
      $options: "i",
    };
  }

  if (
    filters.weatherCondition &&
    filters.weatherCondition.trim() &&
    filters.weatherCondition !== "all"
  ) {
    match.weatherCondition = {
      $regex: `^${escapeRegex(filters.weatherCondition.trim())}$`,
      $options: "i",
    };
  }

  if (filters.minTemp !== undefined || filters.maxTemp !== undefined) {
    const tempCond: Record<string, number> = {};
    if (filters.minTemp !== undefined && !Number.isNaN(filters.minTemp)) {
      tempCond.$gte = filters.minTemp;
    }
    if (filters.maxTemp !== undefined && !Number.isNaN(filters.maxTemp)) {
      tempCond.$lte = filters.maxTemp;
    }
    if (Object.keys(tempCond).length > 0) {
      match.temperature = tempCond;
    }
  }

  return match;
}

export function buildSummaryAggregationPipeline(
  matchFilter: Record<string, unknown>
): PipelineStage[] {
  return [
    { $match: matchFilter },
    {
      $facet: {
        metrics: [
          {
            $group: {
              _id: null,
              totalRecords: { $sum: 1 },
              avgTemperature: { $avg: "$temperature" },
              maxTemperature: { $max: "$temperature" },
              minTemperature: { $min: "$temperature" },
              tempCount: {
                $sum: {
                  $cond: [{ $ne: ["$temperature", null] }, 1, 0],
                },
              },
              avgHumidity: { $avg: "$humidity" },
              humidityCount: {
                $sum: {
                  $cond: [{ $ne: ["$humidity", null] }, 1, 0],
                },
              },
              totalRainfall: {
                $sum: {
                  $cond: [{ $ne: ["$rainfall", null] }, "$rainfall", 0],
                },
              },
              rainfallCount: {
                $sum: {
                  $cond: [{ $ne: ["$rainfall", null] }, 1, 0],
                },
              },
              avgWindSpeed: { $avg: "$windSpeed" },
              windCount: {
                $sum: {
                  $cond: [{ $ne: ["$windSpeed", null] }, 1, 0],
                },
              },
              minTimestamp: { $min: "$timestamp" },
              maxTimestamp: { $max: "$timestamp" },
            },
          },
        ],
        hottest: [
          { $match: { temperature: { $ne: null } } },
          { $sort: { temperature: -1, timestamp: 1 } },
          { $limit: 1 },
          {
            $project: {
              _id: 0,
              timestamp: 1,
              temperature: 1,
              city: 1,
            },
          },
        ],
        coldest: [
          { $match: { temperature: { $ne: null } } },
          { $sort: { temperature: 1, timestamp: 1 } },
          { $limit: 1 },
          {
            $project: {
              _id: 0,
              timestamp: 1,
              temperature: 1,
              city: 1,
            },
          },
        ],
      },
    },
  ];
}

export async function getDatasetSummaryAnalytics(
  dataset: IDataset,
  filters: AnalyticsFilters
) {
  const matchFilter = buildMatchFilter(dataset._id, dataset.ownerId, filters);
  const pipeline = buildSummaryAggregationPipeline(matchFilter);

  const [facetResult, distinctCities, distinctConditions] = await Promise.all([
    WeatherRecordModel.aggregate(pipeline),
    WeatherRecordModel.distinct("city", {
      datasetId: dataset._id,
      ownerId: dataset.ownerId,
      city: { $nin: [null, ""] },
    }),
    WeatherRecordModel.distinct("weatherCondition", {
      datasetId: dataset._id,
      ownerId: dataset.ownerId,
      weatherCondition: { $nin: [null, ""] },
    }),
  ]);

  const rawMetrics = facetResult[0]?.metrics?.[0];
  const hottest = facetResult[0]?.hottest?.[0] ?? null;
  const coldest = facetResult[0]?.coldest?.[0] ?? null;

  return {
    datasetId: String(dataset._id),
    datasetName: dataset.name,
    availableMetrics: dataset.availableMetrics,
    totalRecordsInDataset: dataset.validRowCount,
    totalRecordsInAnalysis: rawMetrics?.totalRecords ?? 0,
    avgTemperature:
      rawMetrics?.tempCount > 0 && rawMetrics.avgTemperature !== null
        ? Number(rawMetrics.avgTemperature.toFixed(2))
        : null,
    maxTemperature:
      rawMetrics?.tempCount > 0 && rawMetrics.maxTemperature !== null
        ? Number(rawMetrics.maxTemperature.toFixed(2))
        : null,
    minTemperature:
      rawMetrics?.tempCount > 0 && rawMetrics.minTemperature !== null
        ? Number(rawMetrics.minTemperature.toFixed(2))
        : null,
    avgHumidity:
      rawMetrics?.humidityCount > 0 && rawMetrics.avgHumidity !== null
        ? Number(rawMetrics.avgHumidity.toFixed(2))
        : null,
    totalRainfall:
      rawMetrics?.rainfallCount > 0
        ? Number(rawMetrics.totalRainfall.toFixed(2))
        : null,
    avgWindSpeed:
      rawMetrics?.windCount > 0 && rawMetrics.avgWindSpeed !== null
        ? Number(rawMetrics.avgWindSpeed.toFixed(2))
        : null,
    hottestObservation: hottest,
    coldestObservation: coldest,
    minTimestamp: rawMetrics?.minTimestamp ?? null,
    maxTimestamp: rawMetrics?.maxTimestamp ?? null,
    filterOptions: {
      cities: (distinctCities as string[]).filter(Boolean).sort(),
      weatherConditions: (distinctConditions as string[]).filter(Boolean).sort(),
    },
  };
}

function resolveDateFormat(
  granularity: "auto" | "hourly" | "daily" | "monthly",
  dateRangeStart?: Date | null,
  dateRangeEnd?: Date | null,
  defaultAuto: "hourly" | "daily" = "daily"
): { format: string; resolvedGranularity: "hourly" | "daily" | "monthly" } {
  if (granularity === "hourly") {
    return { format: "%Y-%m-%d %H:00", resolvedGranularity: "hourly" };
  }
  if (granularity === "monthly") {
    return { format: "%Y-%m", resolvedGranularity: "monthly" };
  }
  if (granularity === "daily") {
    return { format: "%Y-%m-%d", resolvedGranularity: "daily" };
  }

  if (dateRangeStart && dateRangeEnd) {
    const diffMs = dateRangeEnd.getTime() - dateRangeStart.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= 3) {
      return { format: "%Y-%m-%d %H:00", resolvedGranularity: "hourly" };
    }
    if (diffDays > 120) {
      return { format: "%Y-%m", resolvedGranularity: "monthly" };
    }
    return { format: "%Y-%m-%d", resolvedGranularity: "daily" };
  }

  return defaultAuto === "hourly"
    ? { format: "%Y-%m-%d %H:00", resolvedGranularity: "hourly" }
    : { format: "%Y-%m-%d", resolvedGranularity: "daily" };
}

export async function getTemperatureTrends(
  dataset: IDataset,
  filters: AnalyticsFilters
) {
  const env = getServerEnv();
  const matchFilter = buildMatchFilter(dataset._id, dataset.ownerId, filters);
  matchFilter.temperature = {
    ...(typeof matchFilter.temperature === "object" && matchFilter.temperature
      ? matchFilter.temperature
      : {}),
    $ne: null,
  };

  const { format, resolvedGranularity } = resolveDateFormat(
    filters.granularity ?? "auto",
    filters.startDate ? new Date(filters.startDate) : dataset.dateRangeStart,
    filters.endDate ? new Date(filters.endDate) : dataset.dateRangeEnd
  );

  const pipeline: PipelineStage[] = [
    { $match: matchFilter },
    {
      $group: {
        _id: {
          $dateToString: {
            format,
            date: "$timestamp",
            timezone: env.APP_TIMEZONE,
          },
        },
        avgTemperature: { $avg: "$temperature" },
        minTemperature: { $min: "$temperature" },
        maxTemperature: { $max: "$temperature" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 500 },
    {
      $project: {
        _id: 0,
        period: "$_id",
        avgTemperature: { $round: ["$avgTemperature", 2] },
        minTemperature: { $round: ["$minTemperature", 2] },
        maxTemperature: { $round: ["$maxTemperature", 2] },
        count: 1,
      },
    },
  ];

  const series = await WeatherRecordModel.aggregate(pipeline);
  return {
    granularity: resolvedGranularity,
    unit: "°C",
    series,
  };
}

export async function getRainfallAnalytics(
  dataset: IDataset,
  filters: AnalyticsFilters
) {
  const env = getServerEnv();
  const matchFilter = buildMatchFilter(dataset._id, dataset.ownerId, filters);
  matchFilter.rainfall = { $ne: null };

  const { format, resolvedGranularity } = resolveDateFormat(
    filters.granularity === "hourly" ? "daily" : filters.granularity ?? "auto",
    filters.startDate ? new Date(filters.startDate) : dataset.dateRangeStart,
    filters.endDate ? new Date(filters.endDate) : dataset.dateRangeEnd,
    "daily"
  );

  const pipeline: PipelineStage[] = [
    { $match: matchFilter },
    {
      $group: {
        _id: {
          $dateToString: {
            format,
            date: "$timestamp",
            timezone: env.APP_TIMEZONE,
          },
        },
        totalRainfall: { $sum: "$rainfall" },
        avgRainfall: { $avg: "$rainfall" },
        maxRainfall: { $max: "$rainfall" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 500 },
    {
      $project: {
        _id: 0,
        period: "$_id",
        totalRainfall: { $round: ["$totalRainfall", 2] },
        avgRainfall: { $round: ["$avgRainfall", 2] },
        maxRainfall: { $round: ["$maxRainfall", 2] },
        count: 1,
      },
    },
  ];

  const series = await WeatherRecordModel.aggregate(pipeline);
  let peakPeriod: { period: string; totalRainfall: number } | null = null;
  for (const item of series) {
    if (!peakPeriod || item.totalRainfall > peakPeriod.totalRainfall) {
      peakPeriod = {
        period: item.period,
        totalRainfall: item.totalRainfall,
      };
    }
  }

  return {
    granularity: resolvedGranularity,
    unit: "mm",
    peakPeriod,
    series,
  };
}

export async function getHumidityAnalytics(
  dataset: IDataset,
  filters: AnalyticsFilters
) {
  const env = getServerEnv();
  const matchFilter = buildMatchFilter(dataset._id, dataset.ownerId, filters);
  matchFilter.humidity = { $ne: null };

  const { format, resolvedGranularity } = resolveDateFormat(
    filters.granularity ?? "auto",
    filters.startDate ? new Date(filters.startDate) : dataset.dateRangeStart,
    filters.endDate ? new Date(filters.endDate) : dataset.dateRangeEnd
  );

  const pipeline: PipelineStage[] = [
    { $match: matchFilter },
    {
      $group: {
        _id: {
          $dateToString: {
            format,
            date: "$timestamp",
            timezone: env.APP_TIMEZONE,
          },
        },
        avgHumidity: { $avg: "$humidity" },
        minHumidity: { $min: "$humidity" },
        maxHumidity: { $max: "$humidity" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 500 },
    {
      $project: {
        _id: 0,
        period: "$_id",
        avgHumidity: { $round: ["$avgHumidity", 2] },
        minHumidity: { $round: ["$minHumidity", 2] },
        maxHumidity: { $round: ["$maxHumidity", 2] },
        count: 1,
      },
    },
  ];

  const series = await WeatherRecordModel.aggregate(pipeline);
  return {
    granularity: resolvedGranularity,
    unit: "%",
    series,
  };
}

export async function getWindAnalytics(
  dataset: IDataset,
  filters: AnalyticsFilters
) {
  const env = getServerEnv();
  const matchFilter = buildMatchFilter(dataset._id, dataset.ownerId, filters);
  matchFilter.windSpeed = { $ne: null };

  const { format, resolvedGranularity } = resolveDateFormat(
    filters.granularity ?? "auto",
    filters.startDate ? new Date(filters.startDate) : dataset.dateRangeStart,
    filters.endDate ? new Date(filters.endDate) : dataset.dateRangeEnd
  );

  const pipeline: PipelineStage[] = [
    { $match: matchFilter },
    {
      $group: {
        _id: {
          $dateToString: {
            format,
            date: "$timestamp",
            timezone: env.APP_TIMEZONE,
          },
        },
        avgWindSpeed: { $avg: "$windSpeed" },
        maxWindSpeed: { $max: "$windSpeed" },
        minWindSpeed: { $min: "$windSpeed" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 500 },
    {
      $project: {
        _id: 0,
        period: "$_id",
        avgWindSpeed: { $round: ["$avgWindSpeed", 2] },
        maxWindSpeed: { $round: ["$maxWindSpeed", 2] },
        minWindSpeed: { $round: ["$minWindSpeed", 2] },
        count: 1,
      },
    },
  ];

  const series = await WeatherRecordModel.aggregate(pipeline);
  return {
    granularity: resolvedGranularity,
    unit: "km/h",
    series,
  };
}

export async function getWeatherConditionAnalytics(
  dataset: IDataset,
  filters: AnalyticsFilters
) {
  const matchFilter = buildMatchFilter(dataset._id, dataset.ownerId, filters);
  matchFilter.weatherCondition = {
    ...(typeof matchFilter.weatherCondition === "object" &&
    matchFilter.weatherCondition
      ? matchFilter.weatherCondition
      : {}),
    $nin: [null, ""],
  };

  const pipeline: PipelineStage[] = [
    { $match: matchFilter },
    {
      $group: {
        _id: "$weatherCondition",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ];

  const rawGroups = await WeatherRecordModel.aggregate(pipeline);

  // Normalize categories for analytical grouping without overwriting original values
  const normalizedTotals = new Map<
    string,
    { condition: string; count: number; rawVariants: string[] }
  >();
  let totalCount = 0;

  for (const item of rawGroups) {
    const rawStr = String(item._id);
    const canonical = normalizeWeatherConditionForAnalytics(rawStr);
    totalCount += item.count;

    const existing = normalizedTotals.get(canonical);
    if (existing) {
      existing.count += item.count;
      if (!existing.rawVariants.includes(rawStr)) {
        existing.rawVariants.push(rawStr);
      }
    } else {
      normalizedTotals.set(canonical, {
        condition: canonical,
        count: item.count,
        rawVariants: [rawStr],
      });
    }
  }

  const distribution = Array.from(normalizedTotals.values())
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({
      condition: entry.condition,
      count: entry.count,
      percentage:
        totalCount > 0 ? Number(((entry.count / totalCount) * 100).toFixed(1)) : 0,
      rawVariants: entry.rawVariants,
    }));

  return {
    totalCategorized: totalCount,
    distribution,
  };
}

export interface FlaggedRecordIssue {
  recordId: string;
  rawRowNumber: number;
  timestamp: Date;
  city: string | null;
  issueType:
    | "missing_value"
    | "out_of_range"
    | "inconsistent_category"
    | "unexpected_condition";
  severity: "warning";
  field: string;
  originalValue: string;
  message: string;
  record: {
    _id: string;
    timestamp: Date;
    city?: string | null;
    temperature?: number | null;
    humidity?: number | null;
    rainfall?: number | null;
    windSpeed?: number | null;
    weatherCondition?: string | null;
    rawRowNumber: number;
  };
}

export function inspectSingleRecordQuality(
  record: IWeatherRecord | Record<string, unknown>,
  availableMetrics: string[],
  hasCityMapped: boolean,
  ranges: PlausibleRanges = DEFAULT_PLAUSIBLE_RANGES
): FlaggedRecordIssue[] {
  const issues: FlaggedRecordIssue[] = [];
  const recId = String(record._id);
  const rawRowNumber = Number(record.rawRowNumber ?? 0);
  const ts = new Date(record.timestamp as Date);
  const city = (record.city as string | null) ?? null;

  const baseRecord = {
    _id: recId,
    timestamp: ts,
    city,
    temperature: (record.temperature as number | null) ?? null,
    humidity: (record.humidity as number | null) ?? null,
    rainfall: (record.rainfall as number | null) ?? null,
    windSpeed: (record.windSpeed as number | null) ?? null,
    weatherCondition: (record.weatherCondition as string | null) ?? null,
    rawRowNumber,
  };

  if (hasCityMapped && (!city || !city.trim())) {
    issues.push({
      recordId: recId,
      rawRowNumber,
      timestamp: ts,
      city,
      issueType: "missing_value",
      severity: "warning",
      field: "city",
      originalValue: "null",
      message: "Missing city/location value.",
      record: baseRecord,
    });
  }

  const numericChecks: {
    key: keyof PlausibleRanges;
    label: string;
    unit: string;
  }[] = [
    { key: "temperature", label: "Temperature", unit: "°C" },
    { key: "humidity", label: "Humidity", unit: "%" },
    { key: "rainfall", label: "Rainfall", unit: "mm" },
    { key: "windSpeed", label: "Wind speed", unit: "km/h" },
  ];

  for (const nc of numericChecks) {
    if (!availableMetrics.includes(nc.key)) continue;
    const val = baseRecord[nc.key];
    if (val === null || val === undefined) {
      issues.push({
        recordId: recId,
        rawRowNumber,
        timestamp: ts,
        city,
        issueType: "missing_value",
        severity: "warning",
        field: nc.key,
        originalValue: "null",
        message: `Missing ${nc.label.toLowerCase()} measurement.`,
        record: baseRecord,
      });
    } else {
      const r = ranges[nc.key];
      if (val < r.min || val > r.max) {
        issues.push({
          recordId: recId,
          rawRowNumber,
          timestamp: ts,
          city,
          issueType: "out_of_range",
          severity: "warning",
          field: nc.key,
          originalValue: `${val} ${nc.unit}`,
          message: `${nc.label} (${val} ${nc.unit}) is outside plausible range [${r.min}, ${r.max}].`,
          record: baseRecord,
        });
      }
    }
  }

  if (availableMetrics.includes("weatherCondition")) {
    const cond = baseRecord.weatherCondition;
    if (!cond || !cond.trim()) {
      issues.push({
        recordId: recId,
        rawRowNumber,
        timestamp: ts,
        city,
        issueType: "missing_value",
        severity: "warning",
        field: "weatherCondition",
        originalValue: "null",
        message: "Missing weather condition category.",
        record: baseRecord,
      });
    } else {
      const trimmed = cond.trim();
      const lower = trimmed.toLowerCase().replace(/\s+/g, " ");
      const canonical = CANONICAL_CONDITION_MAP[lower];
      if (!STANDARD_WEATHER_CONDITIONS.has(lower) && !canonical) {
        issues.push({
          recordId: recId,
          rawRowNumber,
          timestamp: ts,
          city,
          issueType: "unexpected_condition",
          severity: "warning",
          field: "weatherCondition",
          originalValue: trimmed,
          message: `Unexpected weather condition "${trimmed}" not in standard categories.`,
          record: baseRecord,
        });
      } else if (canonical && trimmed !== canonical) {
        issues.push({
          recordId: recId,
          rawRowNumber,
          timestamp: ts,
          city,
          issueType: "inconsistent_category",
          severity: "warning",
          field: "weatherCondition",
          originalValue: trimmed,
          message: `Inconsistent category spelling/capitalization "${trimmed}" (expected "${canonical}").`,
          record: baseRecord,
        });
      }
    }
  }

  return issues;
}

export async function getDatasetQualityAnalysis(
  dataset: IDataset,
  issueFilter?: string
) {
  const ranges = DEFAULT_PLAUSIBLE_RANGES;
  const matchStage = {
    datasetId: dataset._id,
    ownerId: dataset.ownerId,
  };

  // Run MongoDB aggregation to compute column-level counts and out-of-range counts directly on the server
  const [aggStats, distinctCities, distinctConditions, distinctTimestamps] =
    await Promise.all([
      WeatherRecordModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            storedRecordCount: { $sum: 1 },
            minTimestamp: { $min: "$timestamp" },
            maxTimestamp: { $max: "$timestamp" },
            cityNonNull: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ["$city", null] }, { $ne: ["$city", ""] }] },
                  1,
                  0,
                ],
              },
            },
            tempNonNull: {
              $sum: { $cond: [{ $ne: ["$temperature", null] }, 1, 0] },
            },
            tempOutOfRange: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$temperature", null] },
                      {
                        $or: [
                          { $lt: ["$temperature", ranges.temperature.min] },
                          { $gt: ["$temperature", ranges.temperature.max] },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            humidityNonNull: {
              $sum: { $cond: [{ $ne: ["$humidity", null] }, 1, 0] },
            },
            humidityOutOfRange: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$humidity", null] },
                      {
                        $or: [
                          { $lt: ["$humidity", ranges.humidity.min] },
                          { $gt: ["$humidity", ranges.humidity.max] },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            rainfallNonNull: {
              $sum: { $cond: [{ $ne: ["$rainfall", null] }, 1, 0] },
            },
            rainfallOutOfRange: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$rainfall", null] },
                      {
                        $or: [
                          { $lt: ["$rainfall", ranges.rainfall.min] },
                          { $gt: ["$rainfall", ranges.rainfall.max] },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            windNonNull: {
              $sum: { $cond: [{ $ne: ["$windSpeed", null] }, 1, 0] },
            },
            windOutOfRange: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$windSpeed", null] },
                      {
                        $or: [
                          { $lt: ["$windSpeed", ranges.windSpeed.min] },
                          { $gt: ["$windSpeed", ranges.windSpeed.max] },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            conditionNonNull: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$weatherCondition", null] },
                      { $ne: ["$weatherCondition", ""] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      WeatherRecordModel.distinct("city", {
        ...matchStage,
        city: { $nin: [null, ""] },
      }),
      WeatherRecordModel.distinct("weatherCondition", {
        ...matchStage,
        weatherCondition: { $nin: [null, ""] },
      }),
      WeatherRecordModel.distinct("timestamp", matchStage),
    ]);

  const stats = aggStats[0] ?? {
    storedRecordCount: 0,
    minTimestamp: null,
    maxTimestamp: null,
    cityNonNull: 0,
    tempNonNull: 0,
    tempOutOfRange: 0,
    humidityNonNull: 0,
    humidityOutOfRange: 0,
    rainfallNonNull: 0,
    rainfallOutOfRange: 0,
    windNonNull: 0,
    windOutOfRange: 0,
    conditionNonNull: 0,
  };

  const totalStored = stats.storedRecordCount as number;
  const hasCityMapped = Boolean(dataset.columnMapping?.city || dataset.defaultCity);
  const metrics = dataset.availableMetrics ?? [];

  const buildColRow = (
    fieldKey: string,
    label: string,
    detectedType: "datetime" | "numeric" | "string",
    nonNull: number,
    distinctCount: number | null,
    outOfRangeCount = 0
  ) => {
    const missing = Math.max(0, totalStored - nonNull);
    const missingPercentage =
      totalStored > 0 ? Number(((missing / totalStored) * 100).toFixed(2)) : 0;
    return {
      fieldKey,
      columnName:
        dataset.columnMapping?.[fieldKey as keyof typeof dataset.columnMapping] ||
        label,
      normalizedField: label,
      detectedType,
      nonNullCount: nonNull,
      missingCount: missing,
      missingPercentage,
      distinctCount,
      invalidOrFlaggedCount: outOfRangeCount,
    };
  };

  const columnQualityTable = [
    buildColRow(
      "timestamp",
      "Timestamp",
      "datetime",
      totalStored,
      distinctTimestamps.length,
      0
    ),
  ];

  if (hasCityMapped) {
    columnQualityTable.push(
      buildColRow(
        "city",
        "City / Location",
        "string",
        stats.cityNonNull,
        distinctCities.length,
        0
      )
    );
  }
  if (metrics.includes("temperature")) {
    columnQualityTable.push(
      buildColRow(
        "temperature",
        "Temperature (°C)",
        "numeric",
        stats.tempNonNull,
        null,
        stats.tempOutOfRange
      )
    );
  }
  if (metrics.includes("humidity")) {
    columnQualityTable.push(
      buildColRow(
        "humidity",
        "Humidity (%)",
        "numeric",
        stats.humidityNonNull,
        null,
        stats.humidityOutOfRange
      )
    );
  }
  if (metrics.includes("rainfall")) {
    columnQualityTable.push(
      buildColRow(
        "rainfall",
        "Rainfall (mm)",
        "numeric",
        stats.rainfallNonNull,
        null,
        stats.rainfallOutOfRange
      )
    );
  }
  if (metrics.includes("windSpeed")) {
    columnQualityTable.push(
      buildColRow(
        "windSpeed",
        "Wind Speed (km/h)",
        "numeric",
        stats.windNonNull,
        null,
        stats.windOutOfRange
      )
    );
  }
  if (metrics.includes("weatherCondition")) {
    columnQualityTable.push(
      buildColRow(
        "weatherCondition",
        "Weather Condition",
        "string",
        stats.conditionNonNull,
        distinctConditions.length,
        0
      )
    );
  }

  const totalMissingValues = columnQualityTable.reduce(
    (acc, col) => acc + col.missingCount,
    0
  );

  // Build a MongoDB query to fetch candidate records with quality issues (bounded to 150 records)
  const orConditions: Record<string, unknown>[] = [];
  if (hasCityMapped) {
    orConditions.push({ city: { $in: [null, ""] } });
  }
  if (metrics.includes("temperature")) {
    orConditions.push({ temperature: null });
    orConditions.push({
      temperature: { $lt: ranges.temperature.min },
    });
    orConditions.push({
      temperature: { $gt: ranges.temperature.max },
    });
  }
  if (metrics.includes("humidity")) {
    orConditions.push({ humidity: null });
    orConditions.push({ humidity: { $lt: ranges.humidity.min } });
    orConditions.push({ humidity: { $gt: ranges.humidity.max } });
  }
  if (metrics.includes("rainfall")) {
    orConditions.push({ rainfall: null });
    orConditions.push({ rainfall: { $lt: ranges.rainfall.min } });
    orConditions.push({ rainfall: { $gt: ranges.rainfall.max } });
  }
  if (metrics.includes("windSpeed")) {
    orConditions.push({ windSpeed: null });
    orConditions.push({ windSpeed: { $lt: ranges.windSpeed.min } });
    orConditions.push({ windSpeed: { $gt: ranges.windSpeed.max } });
  }
  if (metrics.includes("weatherCondition")) {
    orConditions.push({ weatherCondition: { $in: [null, ""] } });
    // Also check non-canonical conditions from distinctConditions
    const flaggedConditions = (distinctConditions as string[]).filter((c) => {
      const trimmed = c.trim();
      const lower = trimmed.toLowerCase().replace(/\s+/g, " ");
      const canonical = CANONICAL_CONDITION_MAP[lower];
      return (
        (!STANDARD_WEATHER_CONDITIONS.has(lower) && !canonical) ||
        (canonical && trimmed !== canonical)
      );
    });
    if (flaggedConditions.length > 0) {
      orConditions.push({ weatherCondition: { $in: flaggedConditions } });
    }
  }

  let candidateRecords: Record<string, unknown>[] = [];
  if (orConditions.length > 0) {
    candidateRecords = await WeatherRecordModel.find({
      ...matchStage,
      $or: orConditions,
    })
      .sort({ rawRowNumber: 1 })
      .limit(150)
      .lean();
  }

  const allLiveIssues: FlaggedRecordIssue[] = [];
  for (const rec of candidateRecords) {
    const recIssues = inspectSingleRecordQuality(
      rec,
      metrics,
      hasCityMapped,
      ranges
    );
    for (const iss of recIssues) {
      allLiveIssues.push(iss);
    }
  }

  const issueCountsByType = {
    missing_value: allLiveIssues.filter((i) => i.issueType === "missing_value")
      .length,
    out_of_range: allLiveIssues.filter((i) => i.issueType === "out_of_range")
      .length,
    inconsistent_category: allLiveIssues.filter(
      (i) => i.issueType === "inconsistent_category"
    ).length,
    unexpected_condition: allLiveIssues.filter(
      (i) => i.issueType === "unexpected_condition"
    ).length,
    import_invalid: dataset.invalidRowCount,
    import_duplicate: dataset.duplicateRowCount,
  };

  const filteredLiveIssues =
    issueFilter && issueFilter !== "all"
      ? allLiveIssues.filter((i) => i.issueType === issueFilter)
      : allLiveIssues;

  return {
    summary: {
      totalCsvRows: dataset.rowCount,
      validStoredRecords: totalStored,
      invalidRowsRejectedAtImport: dataset.invalidRowCount,
      duplicateRowsSkippedAtImport: dataset.duplicateRowCount,
      totalMissingValuesInStoredRecords: totalMissingValues,
      totalActiveQualityWarnings: allLiveIssues.length,
      columnCount:
        dataset.columns.length > 0
          ? dataset.columns.length
          : columnQualityTable.length,
      dateRangeStart: stats.minTimestamp ?? dataset.dateRangeStart ?? null,
      dateRangeEnd: stats.maxTimestamp ?? dataset.dateRangeEnd ?? null,
    },
    issueCountsByType,
    columnQualityTable,
    flaggedRecords: filteredLiveIssues.slice(0, 100),
    importIssuesPreview: (dataset.importIssuePreview ?? []).filter(
      (i) => i.severity === "fatal" || i.severity === "duplicate"
    ),
    plausibleRanges: ranges,
  };
}

export async function recalculateDatasetMetadata(
  datasetId: string | mongoose.Types.ObjectId
): Promise<IDataset | null> {
  const dataset = await DatasetModel.findById(datasetId);
  if (!dataset) return null;

  const agg = await WeatherRecordModel.aggregate([
    { $match: { datasetId: dataset._id } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        minTs: { $min: "$timestamp" },
        maxTs: { $max: "$timestamp" },
      },
    },
  ]);

  const stats = agg[0];
  dataset.validRowCount = stats?.count ?? 0;
  dataset.dateRangeStart = stats?.minTs ?? null;
  dataset.dateRangeEnd = stats?.maxTs ?? null;
  await dataset.save();
  return dataset;
}

