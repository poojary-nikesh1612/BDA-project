import Papa from "papaparse";
import crypto from "crypto";
import {
  ColumnMapping,
  IImportIssuePreview,
  NormalizedFieldKey,
} from "@/models/Dataset";

export const MAX_CSV_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_CSV_ROWS = 50000;
export const PREVIEW_ROW_LIMIT = 20;
export const ISSUE_PREVIEW_LIMIT = 100;

export interface PlausibleRanges {
  temperature: { min: number; max: number };
  humidity: { min: number; max: number };
  rainfall: { min: number; max: number };
  windSpeed: { min: number; max: number };
}

export const DEFAULT_PLAUSIBLE_RANGES: PlausibleRanges = {
  temperature: { min: -50, max: 58 },
  humidity: { min: 0, max: 100 },
  rainfall: { min: 0, max: 500 },
  windSpeed: { min: 0, max: 250 },
};

export const STANDARD_WEATHER_CONDITIONS = new Set([
  "clear",
  "sunny",
  "partly cloudy",
  "cloudy",
  "overcast",
  "rain",
  "light rain",
  "moderate rain",
  "heavy rain",
  "drizzle",
  "thunderstorm",
  "storm",
  "fog",
  "mist",
  "haze",
  "snow",
  "windy",
  "humid",
]);

export const CANONICAL_CONDITION_MAP: Record<string, string> = {
  clear: "Clear",
  "clear sky": "Clear",
  sunny: "Sunny",
  "partly cloudy": "Partly Cloudy",
  "partly-cloudy": "Partly Cloudy",
  cloudy: "Cloudy",
  overcast: "Overcast",
  rain: "Rain",
  rainy: "Rain",
  "light rain": "Light Rain",
  "moderate rain": "Moderate Rain",
  "heavy rain": "Heavy Rain",
  drizzle: "Drizzle",
  thunderstorm: "Thunderstorm",
  "thunder storm": "Thunderstorm",
  storm: "Storm",
  fog: "Fog",
  foggy: "Fog",
  mist: "Mist",
  haze: "Haze",
  hazy: "Haze",
  snow: "Snow",
  windy: "Windy",
  humid: "Humid",
};

const HEADER_ALIASES: Record<NormalizedFieldKey, string[]> = {
  timestamp: [
    "timestamp",
    "date",
    "datetime",
    "date_time",
    "time",
    "observed_at",
    "observation_time",
    "recorded_at",
    "dt",
  ],
  city: [
    "city",
    "location",
    "station",
    "station_name",
    "place",
    "site",
    "district",
    "town",
  ],
  temperature: [
    "temperature",
    "temp",
    "temperature_2m",
    "temp_c",
    "temperature_c",
    "air_temp",
    "air_temperature",
    "temp_celsius",
  ],
  humidity: [
    "humidity",
    "relative_humidity",
    "relativehumidity",
    "rh",
    "humidity_percent",
    "relative_humidity_2m",
  ],
  rainfall: [
    "rainfall",
    "precipitation",
    "precipitation_mm",
    "rain",
    "rain_mm",
    "rainfall_mm",
    "precip",
  ],
  windSpeed: [
    "wind_speed",
    "windspeed",
    "wind_speed_10m",
    "wind",
    "wind_kmh",
    "wind_speed_kmh",
  ],
  weatherCondition: [
    "weather_condition",
    "weathercondition",
    "condition",
    "weather",
    "sky_condition",
    "summary",
    "weather_desc",
    "description",
  ],
};

export function normalizeColumnHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  for (const rawHeader of headers) {
    const normalized = normalizeColumnHeader(rawHeader);
    for (const [fieldKey, aliases] of Object.entries(HEADER_ALIASES) as [
      NormalizedFieldKey,
      string[],
    ][]) {
      if (!mapping[fieldKey] && aliases.includes(normalized)) {
        mapping[fieldKey] = rawHeader;
        break;
      }
    }
  }

  return mapping;
}

export function validateColumnMapping(
  headers: string[],
  mapping: ColumnMapping
): { valid: boolean; errors: string[]; availableMetrics: string[] } {
  const errors: string[] = [];
  const headerSet = new Set(headers);

  if (!mapping.timestamp || !mapping.timestamp.trim()) {
    errors.push("Timestamp column mapping is required.");
  } else if (!headerSet.has(mapping.timestamp)) {
    errors.push(
      `Mapped timestamp column "${mapping.timestamp}" does not exist in CSV headers.`
    );
  }

  const measurementKeys: NormalizedFieldKey[] = [
    "temperature",
    "humidity",
    "rainfall",
    "windSpeed",
    "weatherCondition",
  ];

  const availableMetrics: string[] = [];
  for (const key of measurementKeys) {
    const col = mapping[key];
    if (col && col.trim()) {
      if (!headerSet.has(col)) {
        errors.push(`Mapped column "${col}" for ${key} does not exist in CSV headers.`);
      } else {
        availableMetrics.push(key);
      }
    }
  }

  if (mapping.city && mapping.city.trim() && !headerSet.has(mapping.city)) {
    errors.push(`Mapped city column "${mapping.city}" does not exist in CSV headers.`);
  }

  if (availableMetrics.length === 0) {
    errors.push(
      "At least one weather measurement column (temperature, humidity, rainfall, windSpeed, or weatherCondition) must be mapped."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    availableMetrics,
  };
}

export function isMissingCellValue(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  const str = String(raw).trim();
  if (str === "") return true;
  const lower = str.toLowerCase();
  return (
    lower === "null" ||
    lower === "na" ||
    lower === "n/a" ||
    lower === "nan" ||
    lower === "none" ||
    lower === "-"
  );
}

export interface ParsedDateResult {
  date: Date | null;
  formatStyle: "iso" | "slash_dmy" | "slash_mdy" | "other" | "invalid";
}

export function parseFlexibleTimestamp(raw: unknown): ParsedDateResult {
  if (isMissingCellValue(raw)) {
    return { date: null, formatStyle: "invalid" };
  }
  const str = String(raw).trim();

  // Check ISO-like YYYY-MM-DD...
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear();
      if (year >= 1900 && year <= 2100) {
        return { date: parsed, formatStyle: "iso" };
      }
    }
    return { date: null, formatStyle: "invalid" };
  }

  // Check DD/MM/YYYY or DD-MM-YYYY with optional HH:mm(:ss)
  const dmyMatch = str.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    let day = p1;
    let month = p2;
    let style: "slash_dmy" | "slash_mdy" = "slash_dmy";

    // If second part > 12 and first part <= 12, interpret as MM/DD/YYYY
    if (p2 > 12 && p1 <= 12) {
      month = p1;
      day = p2;
      style = "slash_mdy";
    }

    if (
      year >= 1900 &&
      year <= 2100 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31 &&
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      const dt = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      if (
        dt.getUTCFullYear() === year &&
        dt.getUTCMonth() === month - 1 &&
        dt.getUTCDate() === day
      ) {
        return { date: dt, formatStyle: style };
      }
    }
    return { date: null, formatStyle: "invalid" };
  }

  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    const year = fallback.getUTCFullYear();
    if (year >= 1900 && year <= 2100) {
      return { date: fallback, formatStyle: "other" };
    }
  }

  return { date: null, formatStyle: "invalid" };
}

export interface ParsedNumericResult {
  value: number | null;
  isMissing: boolean;
  isInvalid: boolean;
  hasInconsistentFormat: boolean;
}

export function parseNumericMeasurement(raw: unknown): ParsedNumericResult {
  if (isMissingCellValue(raw)) {
    return {
      value: null,
      isMissing: true,
      isInvalid: false,
      hasInconsistentFormat: false,
    };
  }

  const str = String(raw).trim();

  // Strictly numeric (optional sign, digits, optional decimal)
  if (/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(str)) {
    const num = Number(str);
    if (!Number.isFinite(num)) {
      return {
        value: null,
        isMissing: false,
        isInvalid: true,
        hasInconsistentFormat: false,
      };
    }
    const decimalPart = str.split(".")[1];
    const hasExcessiveDecimals = Boolean(decimalPart && decimalPart.length > 4);
    return {
      value: num,
      isMissing: false,
      isInvalid: false,
      hasInconsistentFormat: hasExcessiveDecimals,
    };
  }

  return {
    value: null,
    isMissing: false,
    isInvalid: true,
    hasInconsistentFormat: false,
  };
}

export function normalizeWeatherConditionForAnalytics(
  condition: string | null | undefined
): string {
  if (!condition || !condition.trim()) return "Unspecified";
  const cleaned = condition.trim().toLowerCase().replace(/\s+/g, " ");
  if (CANONICAL_CONDITION_MAP[cleaned]) {
    return CANONICAL_CONDITION_MAP[cleaned];
  }
  return cleaned
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function buildRecordDedupeKey(
  timestamp: Date,
  city: string | null | undefined,
  measurements?: {
    temperature?: number | null;
    humidity?: number | null;
    rainfall?: number | null;
    windSpeed?: number | null;
    weatherCondition?: string | null;
  }
): string {
  const tsIso = timestamp.toISOString();
  const normalizedCity = city ? city.trim().toLowerCase() : "";

  if (normalizedCity) {
    return crypto
      .createHash("sha256")
      .update(`${tsIso}|city:${normalizedCity}`)
      .digest("hex");
  }

  const mStr = measurements
    ? `${measurements.temperature ?? ""}|${measurements.humidity ?? ""}|${
        measurements.rainfall ?? ""
      }|${measurements.windSpeed ?? ""}|${(
        measurements.weatherCondition ?? ""
      )
        .trim()
        .toLowerCase()}`
    : "";

  return crypto
    .createHash("sha256")
    .update(`${tsIso}|nocities|${mStr}`)
    .digest("hex");
}

export interface ValidatedWeatherRow {
  rawRowNumber: number;
  timestamp: Date;
  city: string | null;
  temperature: number | null;
  humidity: number | null;
  rainfall: number | null;
  windSpeed: number | null;
  weatherCondition: string | null;
  dedupeKey: string;
}

export interface ColumnQualityStat {
  columnName: string;
  mappedField: NormalizedFieldKey | null;
  detectedType: "datetime" | "numeric" | "string";
  nonNullCount: number;
  missingCount: number;
  missingPercentage: number;
  distinctCount: number;
  invalidCount: number;
  outOfRangeCount: number;
}

export interface CsvValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  warningCount: number;
  missingValueCount: number;
  headers: string[];
  availableMetrics: string[];
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
  issuesPreview: IImportIssuePreview[];
  columnQuality: ColumnQualityStat[];
  validRecords: ValidatedWeatherRow[];
}

export function parseAndValidateWeatherCsv(
  csvContent: string,
  mapping: ColumnMapping,
  options?: {
    defaultCity?: string;
    plausibleRanges?: PlausibleRanges;
    includeValidRecords?: boolean;
  }
): CsvValidationSummary {
  const ranges = options?.plausibleRanges ?? DEFAULT_PLAUSIBLE_RANGES;
  const defaultCity = options?.defaultCity?.trim() || null;
  const includeValidRecords = options?.includeValidRecords ?? true;

  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: "greedy",
  });

  const headers = (parsed.meta.fields ?? []).map((h) => h.trim()).filter(Boolean);
  const rows = parsed.data ?? [];

  if (rows.length > MAX_CSV_ROWS) {
    throw new Error(
      `CSV exceeds the maximum limit of ${MAX_CSV_ROWS.toLocaleString()} rows (found ${rows.length.toLocaleString()}).`
    );
  }

  const mappingCheck = validateColumnMapping(headers, mapping);
  if (!mappingCheck.valid) {
    throw new Error(mappingCheck.errors.join(" "));
  }

  const issuesPreview: IImportIssuePreview[] = [];
  const pushIssue = (issue: IImportIssuePreview) => {
    if (issuesPreview.length < ISSUE_PREVIEW_LIMIT) {
      issuesPreview.push(issue);
    }
  };

  // Track column-level stats
  const colTrackers = new Map<
    string,
    {
      mappedField: NormalizedFieldKey | null;
      detectedType: "datetime" | "numeric" | "string";
      nonNullCount: number;
      missingCount: number;
      distinctValues: Set<string>;
      invalidCount: number;
      outOfRangeCount: number;
    }
  >();

  const reverseMapping = new Map<string, NormalizedFieldKey>();
  for (const [k, v] of Object.entries(mapping) as [NormalizedFieldKey, string | undefined][]) {
    if (v) reverseMapping.set(v, k);
  }

  for (const header of headers) {
    const mappedField = reverseMapping.get(header) ?? null;
    let detectedType: "datetime" | "numeric" | "string" = "string";
    if (mappedField === "timestamp") detectedType = "datetime";
    else if (
      mappedField === "temperature" ||
      mappedField === "humidity" ||
      mappedField === "rainfall" ||
      mappedField === "windSpeed"
    ) {
      detectedType = "numeric";
    }
    colTrackers.set(header, {
      mappedField,
      detectedType,
      nonNullCount: 0,
      missingCount: 0,
      distinctValues: new Set<string>(),
      invalidCount: 0,
      outOfRangeCount: 0,
    });
  }

  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;
  let warningCount = 0;
  let missingValueCount = 0;
  let dateRangeStart: Date | null = null;
  let dateRangeEnd: Date | null = null;
  let dominantDateFormat: string | null = null;

  const seenDedupeKeys = new Set<string>();
  const validRecords: ValidatedWeatherRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // 1-indexed including header row
    let rowHasFatalError = false;

    // Update basic column trackers for unmapped columns too
    for (const header of headers) {
      const tracker = colTrackers.get(header)!;
      const cellVal = row[header];
      if (isMissingCellValue(cellVal)) {
        tracker.missingCount += 1;
        missingValueCount += 1;
      } else {
        tracker.nonNullCount += 1;
        if (tracker.distinctValues.size < 5000) {
          tracker.distinctValues.add(String(cellVal).trim());
        }
      }
    }

    // 1. Validate Timestamp
    const tsCol = mapping.timestamp!;
    const rawTs = row[tsCol];
    const tsTracker = colTrackers.get(tsCol)!;
    const parsedTs = parseFlexibleTimestamp(rawTs);

    if (!parsedTs.date) {
      rowHasFatalError = true;
      tsTracker.invalidCount += 1;
      pushIssue({
        rowNumber,
        severity: "fatal",
        issueType: isMissingCellValue(rawTs)
          ? "missing_timestamp"
          : "invalid_timestamp",
        field: "timestamp",
        originalValue: String(rawTs ?? ""),
        message: isMissingCellValue(rawTs)
          ? "Missing required timestamp."
          : `Invalid timestamp format "${rawTs}".`,
      });
    } else {
      if (!dominantDateFormat) {
        dominantDateFormat = parsedTs.formatStyle;
      } else if (parsedTs.formatStyle !== dominantDateFormat) {
        warningCount += 1;
        pushIssue({
          rowNumber,
          severity: "warning",
          issueType: "inconsistent_format",
          field: "timestamp",
          originalValue: String(rawTs ?? ""),
          message: `Timestamp format (${parsedTs.formatStyle}) differs from dataset dominant format (${dominantDateFormat}).`,
        });
      }
    }

    // 2. City
    let cityValue: string | null = defaultCity;
    if (mapping.city) {
      const rawCity = row[mapping.city];
      if (!isMissingCellValue(rawCity)) {
        cityValue = String(rawCity).trim();
      } else if (!defaultCity) {
        warningCount += 1;
        pushIssue({
          rowNumber,
          severity: "warning",
          issueType: "missing_value",
          field: "city",
          originalValue: "",
          message: "Missing city/location value.",
        });
      }
    }

    // 3. Numeric measurements
    const numericFields: (keyof PlausibleRanges)[] = [
      "temperature",
      "humidity",
      "rainfall",
      "windSpeed",
    ];
    const parsedNumbers: Record<keyof PlausibleRanges, number | null> = {
      temperature: null,
      humidity: null,
      rainfall: null,
      windSpeed: null,
    };

    for (const nf of numericFields) {
      const colName = mapping[nf];
      if (!colName) continue;
      const rawVal = row[colName];
      const tracker = colTrackers.get(colName)!;
      const res = parseNumericMeasurement(rawVal);

      if (res.isInvalid) {
        rowHasFatalError = true;
        tracker.invalidCount += 1;
        pushIssue({
          rowNumber,
          severity: "fatal",
          issueType: "invalid_numeric",
          field: nf,
          originalValue: String(rawVal ?? ""),
          message: `Invalid numeric value "${rawVal}" for ${nf}.`,
        });
      } else if (res.isMissing) {
        warningCount += 1;
        pushIssue({
          rowNumber,
          severity: "warning",
          issueType: "missing_value",
          field: nf,
          originalValue: "",
          message: `Missing measurement for ${nf}.`,
        });
      } else if (res.value !== null) {
        parsedNumbers[nf] = res.value;
        const range = ranges[nf];
        if (res.value < range.min || res.value > range.max) {
          tracker.outOfRangeCount += 1;
          warningCount += 1;
          pushIssue({
            rowNumber,
            severity: "warning",
            issueType: "out_of_range",
            field: nf,
            originalValue: String(rawVal),
            message: `${nf} value ${res.value} is outside plausible range (${range.min} to ${range.max}).`,
          });
        }
        if (res.hasInconsistentFormat) {
          warningCount += 1;
          pushIssue({
            rowNumber,
            severity: "warning",
            issueType: "inconsistent_format",
            field: nf,
            originalValue: String(rawVal),
            message: `${nf} value "${rawVal}" has inconsistent precision (>4 decimals).`,
          });
        }
      }
    }

    // 4. Weather condition
    let conditionValue: string | null = null;
    if (mapping.weatherCondition) {
      const condCol = mapping.weatherCondition;
      const rawCond = row[condCol];
      if (isMissingCellValue(rawCond)) {
        warningCount += 1;
        pushIssue({
          rowNumber,
          severity: "warning",
          issueType: "missing_value",
          field: "weatherCondition",
          originalValue: "",
          message: "Missing weather condition.",
        });
      } else {
        const trimmedCond = String(rawCond).trim();
        conditionValue = trimmedCond;
        const lowerCond = trimmedCond.toLowerCase().replace(/\s+/g, " ");
        const canonical = CANONICAL_CONDITION_MAP[lowerCond];

        if (!STANDARD_WEATHER_CONDITIONS.has(lowerCond) && !canonical) {
          warningCount += 1;
          pushIssue({
            rowNumber,
            severity: "warning",
            issueType: "unexpected_condition",
            field: "weatherCondition",
            originalValue: trimmedCond,
            message: `Unrecognized weather condition category "${trimmedCond}".`,
          });
        } else if (canonical && trimmedCond !== canonical) {
          warningCount += 1;
          pushIssue({
            rowNumber,
            severity: "warning",
            issueType: "inconsistent_category",
            field: "weatherCondition",
            originalValue: trimmedCond,
            message: `Inconsistent category formatting "${trimmedCond}" (canonical: "${canonical}").`,
          });
        }
      }
    }

    // Check if ALL mapped measurements are missing on this row
    const hasAtLeastOneMeasurement =
      parsedNumbers.temperature !== null ||
      parsedNumbers.humidity !== null ||
      parsedNumbers.rainfall !== null ||
      parsedNumbers.windSpeed !== null ||
      conditionValue !== null;

    if (!rowHasFatalError && !hasAtLeastOneMeasurement) {
      rowHasFatalError = true;
      pushIssue({
        rowNumber,
        severity: "fatal",
        issueType: "all_measurements_missing",
        message: "Row contains no valid weather measurements across any mapped column.",
      });
    }

    if (rowHasFatalError || !parsedTs.date) {
      invalidRows += 1;
      continue;
    }

    // 5. Check dataset-scoped duplicate observation
    const dedupeKey = buildRecordDedupeKey(parsedTs.date, cityValue, {
      temperature: parsedNumbers.temperature,
      humidity: parsedNumbers.humidity,
      rainfall: parsedNumbers.rainfall,
      windSpeed: parsedNumbers.windSpeed,
      weatherCondition: conditionValue,
    });

    if (seenDedupeKeys.has(dedupeKey)) {
      duplicateRows += 1;
      pushIssue({
        rowNumber,
        severity: "duplicate",
        issueType: "duplicate_record",
        field: "timestamp",
        originalValue: `${parsedTs.date.toISOString()}${
          cityValue ? ` (${cityValue})` : ""
        }`,
        message: `Duplicate observation for timestamp ${parsedTs.date.toISOString()}${
          cityValue ? ` and location "${cityValue}"` : ""
        }.`,
      });
      continue;
    }

    seenDedupeKeys.add(dedupeKey);
    validRows += 1;

    if (!dateRangeStart || parsedTs.date < dateRangeStart) {
      dateRangeStart = parsedTs.date;
    }
    if (!dateRangeEnd || parsedTs.date > dateRangeEnd) {
      dateRangeEnd = parsedTs.date;
    }

    if (includeValidRecords) {
      validRecords.push({
        rawRowNumber: rowNumber,
        timestamp: parsedTs.date,
        city: cityValue,
        temperature: parsedNumbers.temperature,
        humidity: parsedNumbers.humidity,
        rainfall: parsedNumbers.rainfall,
        windSpeed: parsedNumbers.windSpeed,
        weatherCondition: conditionValue,
        dedupeKey,
      });
    }
  }

  const totalRows = rows.length;
  const columnQuality: ColumnQualityStat[] = headers.map((header) => {
    const t = colTrackers.get(header)!;
    const missingPercentage =
      totalRows > 0 ? Number(((t.missingCount / totalRows) * 100).toFixed(2)) : 0;
    return {
      columnName: header,
      mappedField: t.mappedField,
      detectedType: t.detectedType,
      nonNullCount: t.nonNullCount,
      missingCount: t.missingCount,
      missingPercentage,
      distinctCount: t.distinctValues.size,
      invalidCount: t.invalidCount,
      outOfRangeCount: t.outOfRangeCount,
    };
  });

  return {
    totalRows,
    validRows,
    invalidRows,
    duplicateRows,
    warningCount,
    missingValueCount,
    headers,
    availableMetrics: mappingCheck.availableMetrics,
    dateRangeStart,
    dateRangeEnd,
    issuesPreview,
    columnQuality,
    validRecords,
  };
}

