"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Thermometer,
  Droplets,
  CloudRain,
  Wind,
  Flame,
  Snowflake,
  RotateCcw,
  Filter,
  Database,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatNumber } from "@/lib/utils";

interface AnalysisTabProps {
  datasetId: string;
  datasetName: string;
  availableMetrics: string[];
  refreshKey: number;
}

interface SummaryData {
  datasetId: string;
  datasetName: string;
  availableMetrics: string[];
  totalRecordsInDataset: number;
  totalRecordsInAnalysis: number;
  avgTemperature: number | null;
  maxTemperature: number | null;
  minTemperature: number | null;
  avgHumidity: number | null;
  totalRainfall: number | null;
  avgWindSpeed: number | null;
  hottestObservation: {
    timestamp: string;
    temperature: number;
    city?: string | null;
  } | null;
  coldestObservation: {
    timestamp: string;
    temperature: number;
    city?: string | null;
  } | null;
  minTimestamp: string | null;
  maxTimestamp: string | null;
  filterOptions: {
    cities: string[];
    weatherConditions: string[];
  };
}

interface TempSeriesPoint {
  period: string;
  avgTemperature: number;
  minTemperature: number;
  maxTemperature: number;
  count: number;
}

interface RainSeriesPoint {
  period: string;
  totalRainfall: number;
  avgRainfall: number;
  maxRainfall: number;
  count: number;
}

interface HumiditySeriesPoint {
  period: string;
  avgHumidity: number;
  minHumidity: number;
  maxHumidity: number;
  count: number;
}

interface WindSeriesPoint {
  period: string;
  avgWindSpeed: number;
  maxWindSpeed: number;
  minWindSpeed: number;
  count: number;
}

interface ConditionItem {
  condition: string;
  count: number;
  percentage: number;
  rawVariants: string[];
}

export function AnalysisTab({
  datasetId,
  datasetName,
  availableMetrics,
  refreshKey,
}: AnalysisTabProps) {
  // Filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [city, setCity] = useState("all");
  const [weatherCondition, setWeatherCondition] = useState("all");
  const [minTemp, setMinTemp] = useState("");
  const [maxTemp, setMaxTemp] = useState("");
  const [granularity, setGranularity] = useState<
    "auto" | "hourly" | "daily" | "monthly"
  >("auto");

  // Analytics state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [tempData, setTempData] = useState<{
    granularity: string;
    series: TempSeriesPoint[];
  } | null>(null);
  const [rainData, setRainData] = useState<{
    granularity: string;
    peakPeriod: { period: string; totalRainfall: number } | null;
    series: RainSeriesPoint[];
  } | null>(null);
  const [humidityData, setHumidityData] = useState<{
    granularity: string;
    series: HumiditySeriesPoint[];
  } | null>(null);
  const [windData, setWindData] = useState<{
    granularity: string;
    series: WindSeriesPoint[];
  } | null>(null);
  const [conditionData, setConditionData] = useState<{
    totalCategorized: number;
    distribution: ConditionItem[];
  } | null>(null);

  const hasTemp = availableMetrics.includes("temperature");
  const hasHumidity = availableMetrics.includes("humidity");
  const hasRainfall = availableMetrics.includes("rainfall");
  const hasWind = availableMetrics.includes("windSpeed");
  const hasConditions = availableMetrics.includes("weatherCondition");

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (city && city !== "all") params.set("city", city);
    if (weatherCondition && weatherCondition !== "all") {
      params.set("weatherCondition", weatherCondition);
    }
    if (minTemp.trim() !== "") params.set("minTemp", minTemp.trim());
    if (maxTemp.trim() !== "") params.set("maxTemp", maxTemp.trim());
    if (granularity) params.set("granularity", granularity);

    const qs = params.toString();

    try {
      const requests: Promise<Response>[] = [
        fetch(`/api/datasets/${datasetId}/analytics/summary?${qs}`),
      ];
      if (hasTemp) {
        requests.push(
          fetch(`/api/datasets/${datasetId}/analytics/temperature?${qs}`)
        );
      }
      if (hasRainfall) {
        requests.push(
          fetch(`/api/datasets/${datasetId}/analytics/rainfall?${qs}`)
        );
      }
      if (hasHumidity) {
        requests.push(
          fetch(`/api/datasets/${datasetId}/analytics/humidity?${qs}`)
        );
      }
      if (hasWind) {
        requests.push(fetch(`/api/datasets/${datasetId}/analytics/wind?${qs}`));
      }
      if (hasConditions) {
        requests.push(
          fetch(`/api/datasets/${datasetId}/analytics/conditions?${qs}`)
        );
      }

      const responses = await Promise.all(requests);
      let idx = 0;

      const summaryRes = responses[idx++];
      const summaryJson = await summaryRes.json();
      if (!summaryRes.ok) {
        setError(summaryJson.error || "Failed to load summary analytics.");
        return;
      }
      setSummary(summaryJson.summary);

      if (hasTemp) {
        const r = await responses[idx++].json();
        setTempData(r.temperature ?? null);
      }
      if (hasRainfall) {
        const r = await responses[idx++].json();
        setRainData(r.rainfall ?? null);
      }
      if (hasHumidity) {
        const r = await responses[idx++].json();
        setHumidityData(r.humidity ?? null);
      }
      if (hasWind) {
        const r = await responses[idx++].json();
        setWindData(r.wind ?? null);
      }
      if (hasConditions) {
        const r = await responses[idx++].json();
        setConditionData(r.conditions ?? null);
      }
    } catch {
      setError("Network error while querying MongoDB analytics pipelines.");
    } finally {
      setLoading(false);
    }
  }, [
    datasetId,
    startDate,
    endDate,
    city,
    weatherCondition,
    minTemp,
    maxTemp,
    granularity,
    hasTemp,
    hasRainfall,
    hasHumidity,
    hasWind,
    hasConditions,
  ]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics, refreshKey]);

  function handleResetFilters() {
    setStartDate("");
    setEndDate("");
    setCity("all");
    setWeatherCondition("all");
    setMinTemp("");
    setMaxTemp("");
    setGranularity("auto");
  }

  const activeFilterChips: string[] = [];
  if (startDate) activeFilterChips.push(`From: ${startDate}`);
  if (endDate) activeFilterChips.push(`To: ${endDate}`);
  if (city !== "all") activeFilterChips.push(`Location: ${city}`);
  if (weatherCondition !== "all")
    activeFilterChips.push(`Condition: ${weatherCondition}`);
  if (minTemp.trim() !== "") activeFilterChips.push(`Min Temp: ${minTemp}°C`);
  if (maxTemp.trim() !== "") activeFilterChips.push(`Max Temp: ${maxTemp}°C`);
  if (granularity !== "auto")
    activeFilterChips.push(`Grouping: ${granularity}`);

  return (
    <div className="space-y-6">
      {/* A. Global Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Global Analytics Filters — {datasetName}
              </CardTitle>
              <CardDescription>
                All summary cards and charts below are computed dynamically on
                the server using MongoDB aggregation pipelines.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {summary && (
                <Badge variant="secondary" className="text-xs">
                  Analyzing {summary.totalRecordsInAnalysis.toLocaleString()} of{" "}
                  {summary.totalRecordsInDataset.toLocaleString()} records
                </Badge>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1">
              <Label htmlFor="filter-start" className="text-xs">
                Start Date
              </Label>
              <Input
                id="filter-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="filter-end" className="text-xs">
                End Date
              </Label>
              <Input
                id="filter-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {summary && summary.filterOptions.cities.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="filter-city" className="text-xs">
                  City / Location
                </Label>
                <select
                  id="filter-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs"
                >
                  <option value="all">All Locations</option>
                  {summary.filterOptions.cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {summary && summary.filterOptions.weatherConditions.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="filter-cond" className="text-xs">
                  Weather Condition
                </Label>
                <select
                  id="filter-cond"
                  value={weatherCondition}
                  onChange={(e) => setWeatherCondition(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs"
                >
                  <option value="all">All Conditions</option>
                  {summary.filterOptions.weatherConditions.map((cond) => (
                    <option key={cond} value={cond}>
                      {cond}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {hasTemp && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="filter-min-temp" className="text-xs">
                    Min Temp (°C)
                  </Label>
                  <Input
                    id="filter-min-temp"
                    type="number"
                    step="0.5"
                    placeholder="e.g. 15"
                    value={minTemp}
                    onChange={(e) => setMinTemp(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="filter-max-temp" className="text-xs">
                    Max Temp (°C)
                  </Label>
                  <Input
                    id="filter-max-temp"
                    type="number"
                    step="0.5"
                    placeholder="e.g. 40"
                    value={maxTemp}
                    onChange={(e) => setMaxTemp(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-slate-600">Active Filters:</span>
              {activeFilterChips.length === 0 ? (
                <span className="text-slate-400">
                  None (Showing complete dataset)
                </span>
              ) : (
                activeFilterChips.map((chip) => (
                  <Badge key={chip} variant="outline" className="bg-slate-50">
                    {chip}
                  </Badge>
                ))
              )}
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="granularity-select" className="text-xs text-slate-600">
                Time Grouping:
              </Label>
              <select
                id="granularity-select"
                value={granularity}
                onChange={(e) =>
                  setGranularity(
                    e.target.value as "auto" | "hourly" | "daily" | "monthly"
                  )
                }
                className="rounded border bg-white px-2 py-1 text-xs"
              >
                <option value="auto">Auto (Smart Density)</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* B. Summary Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Records in Analysis</span>
                <Database className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {summary.totalRecordsInAnalysis.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">
                Out of {summary.totalRecordsInDataset.toLocaleString()} total
                stored records
              </p>
            </CardContent>
          </Card>

          {hasTemp && (
            <>
              <Card>
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Average Temperature</span>
                    <Thermometer className="h-4 w-4 text-orange-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatNumber(summary.avgTemperature, 1, "°C")}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Min: {formatNumber(summary.minTemperature, 1, "°C")} • Max:{" "}
                    {formatNumber(summary.maxTemperature, 1, "°C")}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Hottest Observation</span>
                    <Flame className="h-4 w-4 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    {summary.hottestObservation
                      ? `${summary.hottestObservation.temperature.toFixed(1)} °C`
                      : "—"}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {summary.hottestObservation
                      ? `${formatDateTime(
                          summary.hottestObservation.timestamp
                        )}${
                          summary.hottestObservation.city
                            ? ` (${summary.hottestObservation.city})`
                            : ""
                        }`
                      : "No temperature observations"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Coldest Observation</span>
                    <Snowflake className="h-4 w-4 text-sky-500" />
                  </div>
                  <p className="text-2xl font-bold text-sky-600">
                    {summary.coldestObservation
                      ? `${summary.coldestObservation.temperature.toFixed(1)} °C`
                      : "—"}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {summary.coldestObservation
                      ? `${formatDateTime(
                          summary.coldestObservation.timestamp
                        )}${
                          summary.coldestObservation.city
                            ? ` (${summary.coldestObservation.city})`
                            : ""
                        }`
                      : "No temperature observations"}
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {hasHumidity && (
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Average Humidity</span>
                  <Droplets className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {formatNumber(summary.avgHumidity, 1, "%")}
                </p>
                <p className="text-[11px] text-slate-500">
                  Relative humidity across filtered records
                </p>
              </CardContent>
            </Card>
          )}

          {hasRainfall && (
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Total Rainfall</span>
                  <CloudRain className="h-4 w-4 text-indigo-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {formatNumber(summary.totalRainfall, 1, "mm")}
                </p>
                <p className="text-[11px] text-slate-500">
                  Cumulative precipitation in range
                </p>
              </CardContent>
            </Card>
          )}

          {hasWind && (
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Average Wind Speed</span>
                  <Wind className="h-4 w-4 text-teal-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {formatNumber(summary.avgWindSpeed, 1, "km/h")}
                </p>
                <p className="text-[11px] text-slate-500">
                  Mean wind speed across observations
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* Empty filter result notice */}
      {!loading && summary && summary.totalRecordsInAnalysis === 0 && (
        <Card className="border-dashed py-10 text-center">
          <CardContent className="space-y-3">
            <p className="text-base font-semibold text-slate-900">
              No Weather Records Match Your Active Filters
            </p>
            <p className="text-xs text-slate-500">
              Try broadening the date range, temperature bounds, or location
              filter.
            </p>
            <Button variant="outline" size="sm" onClick={handleResetFilters}>
              Reset All Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Charts Grid */}
      {!loading && summary && summary.totalRecordsInAnalysis > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* C. Temperature Trends */}
          {hasTemp ? (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Temperature Trends (°C)
                    </CardTitle>
                    <CardDescription>
                      Average, minimum, and maximum temperature grouped{" "}
                      {tempData?.granularity || "chronologically"} via MongoDB{" "}
                      <code>$group</code> pipeline
                    </CardDescription>
                  </div>
                  <Badge variant="outline">Unit: °C</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {tempData && tempData.series.length > 0 ? (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={tempData.series}
                        margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 11 }}
                          stroke="#64748b"
                        />
                        <YAxis
                          unit="°C"
                          tick={{ fontSize: 11 }}
                          stroke="#64748b"
                        />
                        <Tooltip
                          formatter={(val: number, name: string) => [
                            `${Number(val).toFixed(2)} °C`,
                            name,
                          ]}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="maxTemperature"
                          name="Max Temp (°C)"
                          stroke="#ef4444"
                          strokeWidth={1.75}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="avgTemperature"
                          name="Avg Temp (°C)"
                          stroke="#2563eb"
                          strokeWidth={2.5}
                        />
                        <Line
                          type="monotone"
                          dataKey="minTemperature"
                          name="Min Temp (°C)"
                          stroke="#0ea5e9"
                          strokeWidth={1.75}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-12 text-center text-xs text-slate-500">
                    No non-null temperature observations in the current filter
                    range.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Temperature Trends</CardTitle>
                <CardDescription>
                  This dataset does not contain a mapped temperature measurement
                  column.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* D. Rainfall Analysis */}
          {hasRainfall ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      Rainfall / Precipitation Analysis (mm)
                    </CardTitle>
                    <CardDescription>
                      Total precipitation grouped by{" "}
                      {rainData?.granularity || "period"}
                    </CardDescription>
                  </div>
                  {rainData?.peakPeriod &&
                    rainData.peakPeriod.totalRainfall > 0 && (
                      <Badge variant="secondary" className="text-[11px]">
                        Peak: {rainData.peakPeriod.period} (
                        {rainData.peakPeriod.totalRainfall.toFixed(1)} mm)
                      </Badge>
                    )}
                </div>
              </CardHeader>
              <CardContent>
                {rainData && rainData.series.length > 0 ? (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={rainData.series}
                        margin={{ top: 10, right: 15, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 11 }}
                          stroke="#64748b"
                        />
                        <YAxis
                          unit=" mm"
                          tick={{ fontSize: 11 }}
                          stroke="#64748b"
                        />
                        <Tooltip
                          formatter={(val: number, name: string) => [
                            `${Number(val).toFixed(2)} mm`,
                            name,
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="totalRainfall"
                          name="Total Rainfall (mm)"
                          fill="#4f46e5"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-12 text-center text-xs text-slate-500">
                    No non-null rainfall measurements in the current filter
                    range.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rainfall Analysis</CardTitle>
                <CardDescription>
                  This dataset does not contain a mapped rainfall/precipitation
                  column.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* E. Humidity Analysis */}
          {hasHumidity ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Relative Humidity Trends (%)
                    </CardTitle>
                    <CardDescription>
                      Average humidity grouped by{" "}
                      {humidityData?.granularity || "period"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">Unit: %</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {humidityData && humidityData.series.length > 0 ? (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={humidityData.series}
                        margin={{ top: 10, right: 15, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 11 }}
                          stroke="#64748b"
                        />
                        <YAxis
                          unit="%"
                          domain={[0, 100]}
                          tick={{ fontSize: 11 }}
                          stroke="#64748b"
                        />
                        <Tooltip
                          formatter={(val: number, name: string) => [
                            `${Number(val).toFixed(1)}%`,
                            name,
                          ]}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="avgHumidity"
                          name="Avg Humidity (%)"
                          stroke="#0284c7"
                          strokeWidth={2.25}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-12 text-center text-xs text-slate-500">
                    No non-null humidity measurements in the current filter
                    range.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Humidity Analysis</CardTitle>
                <CardDescription>
                  This dataset does not contain a mapped relative humidity
                  column.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* F. Wind Speed Analysis */}
          {hasWind ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Wind Speed Trends (km/h)
                    </CardTitle>
                    <CardDescription>
                      Average and peak wind speeds grouped by{" "}
                      {windData?.granularity || "period"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">Unit: km/h</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {windData && windData.series.length > 0 ? (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={windData.series}
                        margin={{ top: 10, right: 15, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 11 }}
                          stroke="#64748b"
                        />
                        <YAxis
                          unit=" km/h"
                          tick={{ fontSize: 11 }}
                          stroke="#64748b"
                        />
                        <Tooltip
                          formatter={(val: number, name: string) => [
                            `${Number(val).toFixed(2)} km/h`,
                            name,
                          ]}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="avgWindSpeed"
                          name="Avg Wind Speed (km/h)"
                          stroke="#0d9488"
                          strokeWidth={2.25}
                        />
                        <Line
                          type="monotone"
                          dataKey="maxWindSpeed"
                          name="Max Wind Speed (km/h)"
                          stroke="#f59e0b"
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-12 text-center text-xs text-slate-500">
                    No non-null wind speed observations in the current filter
                    range.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Wind Speed Analysis</CardTitle>
                <CardDescription>
                  Wind speed data is unavailable in this dataset.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* G. Weather-Condition Distribution */}
          {hasConditions ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Weather-Condition Distribution
                    </CardTitle>
                    <CardDescription>
                      Frequency by analytically normalized category (preserving
                      original stored values)
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {conditionData?.totalCategorized ?? 0} categorized
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {conditionData && conditionData.distribution.length > 0 ? (
                  <>
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={conditionData.distribution}
                          layout="vertical"
                          margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e2e8f0"
                          />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 11 }}
                            stroke="#64748b"
                          />
                          <YAxis
                            type="category"
                            dataKey="condition"
                            width={100}
                            tick={{ fontSize: 11 }}
                            stroke="#64748b"
                          />
                          <Tooltip
                            formatter={(val: number) => [
                              `${val} observations`,
                              "Count",
                            ]}
                          />
                          <Bar
                            dataKey="count"
                            name="Observations"
                            fill="#0ea5e9"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded border text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-600 border-b">
                          <tr>
                            <th className="px-2.5 py-1.5">Canonical Category</th>
                            <th className="px-2.5 py-1.5">Count</th>
                            <th className="px-2.5 py-1.5">Share</th>
                            <th className="px-2.5 py-1.5">Raw CSV Variants</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {conditionData.distribution.map((item) => (
                            <tr key={item.condition}>
                              <td className="px-2.5 py-1.5 font-medium">
                                {item.condition}
                              </td>
                              <td className="px-2.5 py-1.5">{item.count}</td>
                              <td className="px-2.5 py-1.5">
                                {item.percentage}%
                              </td>
                              <td className="px-2.5 py-1.5 font-mono text-[11px] text-slate-500">
                                {item.rawVariants.join(", ")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-center text-xs text-slate-500">
                    No weather condition categories present in the filtered
                    records.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Weather-Condition Distribution
                </CardTitle>
                <CardDescription>
                  Weather condition categories are unavailable in this dataset.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

