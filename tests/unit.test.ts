import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import {
  normalizeUsername,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  isSessionExpired,
} from "@/lib/auth";
import {
  normalizeColumnHeader,
  suggestColumnMapping,
  validateColumnMapping,
  isMissingCellValue,
  parseFlexibleTimestamp,
  parseNumericMeasurement,
  buildRecordDedupeKey,
  parseAndValidateWeatherCsv,
  normalizeWeatherConditionForAnalytics,
} from "@/lib/csv-validator";
import {
  analyticsFilterSchema,
  recordQuerySchema,
  buildMatchFilter,
  buildSummaryAggregationPipeline,
  inspectSingleRecordQuality,
} from "@/lib/analytics-service";
import { verifyResourceOwnership } from "@/lib/api-helpers";

describe("1. Username Normalization", () => {
  it("trims whitespace and converts usernames to lowercase", () => {
    expect(normalizeUsername("  Alex_Weather  ")).toBe("alex_weather");
    expect(normalizeUsername("ADMIN.USER")).toBe("admin.user");
  });
});

describe("2. Password Hashing and Verification", () => {
  it("hashes a password with bcryptjs and verifies matching/non-matching passwords", async () => {
    const plain = "StrongWeatherPass!2026";
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword(plain, hash)).toBe(true);
    expect(await verifyPassword("WrongPassword123", hash)).toBe(false);
  });
});

describe("3. Session Validation Helpers", () => {
  it("generates 64-char hex session tokens and deterministic SHA-256 hashes", () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();
    expect(token1).toHaveLength(64);
    expect(token1).not.toBe(token2);

    const h1 = hashSessionToken(token1);
    expect(h1).toHaveLength(64);
    expect(hashSessionToken(token1)).toBe(h1);
    expect(h1).not.toBe(token1);
  });

  it("correctly evaluates session expiration timestamps", () => {
    const now = new Date("2026-10-12T10:00:00Z");
    const future = new Date("2026-10-13T10:00:00Z");
    const past = new Date("2026-10-11T10:00:00Z");

    expect(isSessionExpired(future, now)).toBe(false);
    expect(isSessionExpired(past, now)).toBe(true);
    expect(isSessionExpired(now, now)).toBe(true);
  });
});

describe("4 & 5. CSV Column Normalization and Mapping", () => {
  it("normalizes varied CSV column headers consistently", () => {
    expect(normalizeColumnHeader("  Temperature_2m ")).toBe("temperature_2m");
    expect(normalizeColumnHeader("Wind-Speed (km/h)")).toBe("wind_speed_kmh");
    expect(normalizeColumnHeader("Relative Humidity")).toBe("relative_humidity");
  });

  it("automatically suggests column mappings for common weather aliases", () => {
    const headers = [
      "DateTime",
      "Station",
      "Temp",
      "Relative_Humidity",
      "Precipitation_mm",
      "WindSpeed",
      "Weather_Condition",
    ];
    const suggested = suggestColumnMapping(headers);
    expect(suggested).toEqual({
      timestamp: "DateTime",
      city: "Station",
      temperature: "Temp",
      humidity: "Relative_Humidity",
      rainfall: "Precipitation_mm",
      windSpeed: "WindSpeed",
      weatherCondition: "Weather_Condition",
    });
  });

  it("validates required timestamp and at least one measurement column", () => {
    const headers = ["timestamp", "temperature", "humidity"];
    const validRes = validateColumnMapping(headers, {
      timestamp: "timestamp",
      temperature: "temperature",
    });
    expect(validRes.valid).toBe(true);
    expect(validRes.availableMetrics).toEqual(["temperature"]);

    const missingTs = validateColumnMapping(headers, {
      temperature: "temperature",
    });
    expect(missingTs.valid).toBe(false);

    const noMetrics = validateColumnMapping(headers, {
      timestamp: "timestamp",
    });
    expect(noMetrics.valid).toBe(false);
  });
});

describe("6 & 7. Date, Numeric Parsing, and Missing-Value Detection", () => {
  it("detects missing cell representations without converting them to zero", () => {
    expect(isMissingCellValue("")).toBe(true);
    expect(isMissingCellValue("   ")).toBe(true);
    expect(isMissingCellValue("NULL")).toBe(true);
    expect(isMissingCellValue("N/A")).toBe(true);
    expect(isMissingCellValue(null)).toBe(true);
    expect(isMissingCellValue("0")).toBe(false);
    expect(isMissingCellValue(0)).toBe(false);
  });

  it("parses ISO and slash-delimited dates and rejects invalid dates", () => {
    const iso = parseFlexibleTimestamp("2026-10-05T12:00:00Z");
    expect(iso.date?.toISOString()).toBe("2026-10-05T12:00:00.000Z");
    expect(iso.formatStyle).toBe("iso");

    const dmy = parseFlexibleTimestamp("05/10/2026 14:30");
    expect(dmy.date).not.toBeNull();
    expect(dmy.formatStyle).toBe("slash_dmy");

    const invalid = parseFlexibleTimestamp("NOT_A_DATE");
    expect(invalid.date).toBeNull();
    expect(invalid.formatStyle).toBe("invalid");
  });

  it("parses valid numbers, preserves missing as null, and flags non-numeric text", () => {
    const validZero = parseNumericMeasurement("0.0");
    expect(validZero.value).toBe(0);
    expect(validZero.isMissing).toBe(false);
    expect(validZero.isInvalid).toBe(false);

    const missing = parseNumericMeasurement("");
    expect(missing.value).toBeNull();
    expect(missing.isMissing).toBe(true);
    expect(missing.isInvalid).toBe(false);

    const invalid = parseNumericMeasurement("thirty_two");
    expect(invalid.value).toBeNull();
    expect(invalid.isInvalid).toBe(true);
  });
});

describe("8 & 9. Duplicate Detection and Data-Quality Summaries", () => {
  it("distinguishes same-timestamp different-city observations from true duplicates", () => {
    const ts = new Date("2026-10-01T12:00:00Z");
    const keyBengaluru = buildRecordDedupeKey(ts, "Bengaluru");
    const keyMysuru = buildRecordDedupeKey(ts, "Mysuru");
    const keyBengaluruCase = buildRecordDedupeKey(ts, "  bengaluru ");

    expect(keyBengaluru).not.toBe(keyMysuru);
    expect(keyBengaluru).toBe(keyBengaluruCase);
  });

  it("computes accurate validation and data-quality summaries on mixed CSV data", () => {
    const sampleCsv = [
      "timestamp,city,temperature,humidity,rainfall,wind_speed,weather_condition",
      "2026-10-01T06:00:00Z,Bengaluru,24.5,78,0.0,12.0,Partly Cloudy",
      "2026-10-01T06:00:00Z,Mysuru,25.0,72,,10.5,Sunny", // valid with missing rainfall warning
      "2026-10-01T06:00:00Z,Bengaluru,24.5,78,0.0,12.0,Partly Cloudy", // duplicate observation
      "2026-10-01T12:00:00Z,Bengaluru,68.0,105,0.0,14.0,rainy", // out of range temp & humidity + inconsistent category
      "INVALID_DATE,Bengaluru,22.0,80,0.0,10.0,Clear", // fatal invalid timestamp
      "2026-10-02T06:00:00Z,Bengaluru,BAD_NUM,80,0.0,10.0,Clear", // fatal invalid numeric
    ].join("\n");

    const mapping = suggestColumnMapping([
      "timestamp",
      "city",
      "temperature",
      "humidity",
      "rainfall",
      "wind_speed",
      "weather_condition",
    ]);

    const summary = parseAndValidateWeatherCsv(sampleCsv, mapping);

    expect(summary.totalRows).toBe(6);
    expect(summary.validRows).toBe(3);
    expect(summary.duplicateRows).toBe(1);
    expect(summary.invalidRows).toBe(2);
    expect(summary.warningCount).toBeGreaterThanOrEqual(4);
    expect(summary.validRecords[1].rainfall).toBeNull(); // never replaced with 0
  });

  it("flags out-of-range, missing, and inconsistent categories in live record inspection", () => {
    const fakeRecord = {
      _id: new mongoose.Types.ObjectId(),
      rawRowNumber: 15,
      timestamp: new Date("2026-10-04T12:00:00Z"),
      city: "Hubballi",
      temperature: 64.5,
      humidity: null,
      rainfall: 0,
      windSpeed: 14,
      weatherCondition: "partly cloudy",
    };

    const issues = inspectSingleRecordQuality(
      fakeRecord,
      ["temperature", "humidity", "rainfall", "windSpeed", "weatherCondition"],
      true
    );

    const types = issues.map((i) => i.issueType);
    expect(types).toContain("out_of_range");
    expect(types).toContain("missing_value");
    expect(types).toContain("inconsistent_category");
  });
});

describe("10 & 11. Aggregation Pipeline Construction & Filter Validation", () => {
  it("validates filter and pagination parameters with Zod", () => {
    const parsed = recordQuerySchema.parse({
      page: "2",
      limit: "50",
      minTemp: "18.5",
      maxTemp: "35",
      sortBy: "temperature",
      sortOrder: "asc",
    });

    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.minTemp).toBe(18.5);
    expect(parsed.maxTemp).toBe(35);

    expect(() =>
      analyticsFilterSchema.parse({ minTemp: "not-a-number" })
    ).toThrow();
  });

  it("builds dataset- and owner-scoped MongoDB match filters and summary pipelines", () => {
    const dsId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();

    const match = buildMatchFilter(dsId, ownerId, {
      city: "Bengaluru",
      minTemp: 20,
      maxTemp: 32,
    });

    expect(String(match.datasetId)).toBe(String(dsId));
    expect(String(match.ownerId)).toBe(String(ownerId));
    expect(match.temperature).toEqual({ $gte: 20, $lte: 32 });

    const pipeline = buildSummaryAggregationPipeline(match);
    expect(pipeline).toHaveLength(2);
    expect(pipeline[0]).toHaveProperty("$match");
    expect(pipeline[1]).toHaveProperty("$facet");
  });

  it("normalizes weather condition variants for analytical grouping", () => {
    expect(normalizeWeatherConditionForAnalytics("partly cloudy")).toBe(
      "Partly Cloudy"
    );
    expect(normalizeWeatherConditionForAnalytics("CLEAR SKY")).toBe("Clear");
    expect(normalizeWeatherConditionForAnalytics("rainy")).toBe("Rain");
  });
});

describe("12. Ownership Enforcement", () => {
  it("enforces strict user ownership matching on resources", () => {
    const userA = new mongoose.Types.ObjectId();
    const userB = new mongoose.Types.ObjectId();

    expect(verifyResourceOwnership(userA, String(userA))).toBe(true);
    expect(verifyResourceOwnership(userA, String(userB))).toBe(false);
  });
});

