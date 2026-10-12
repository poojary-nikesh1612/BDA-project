"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Eye,
  RotateCcw,
  Loader2,
  AlertCircle,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatNumber } from "@/lib/utils";

export interface WeatherRecordItem {
  _id: string;
  datasetId: string;
  workspaceId: string;
  timestamp: string;
  city?: string | null;
  temperature?: number | null;
  humidity?: number | null;
  rainfall?: number | null;
  windSpeed?: number | null;
  weatherCondition?: string | null;
  rawRowNumber: number;
  createdAt?: string;
  updatedAt?: string;
}

interface DataPreviewTabProps {
  datasetId: string;
  refreshKey: number;
  onDataMutated: () => void;
}

export function DataPreviewTab({
  datasetId,
  refreshKey,
  onDataMutated,
}: DataPreviewTabProps) {
  // Server query filters & pagination
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [weatherCondition, setWeatherCondition] = useState("all");
  const [minTemp, setMinTemp] = useState("");
  const [maxTemp, setMaxTemp] = useState("");
  const [sortBy, setSortBy] = useState<"timestamp" | "temperature">(
    "timestamp"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Server data
  const [records, setRecords] = useState<WeatherRecordItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [conditionOptions, setConditionOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inspect / Edit / Create / Delete Modals
  const [inspectingRecord, setInspectingRecord] =
    useState<WeatherRecordItem | null>(null);
  const [editingRecord, setEditingRecord] =
    useState<WeatherRecordItem | null>(null);
  const [creatingRecord, setCreatingRecord] = useState(false);
  const [deletingRecord, setDeletingRecord] =
    useState<WeatherRecordItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Record Form Fields
  const [formTimestamp, setFormTimestamp] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formTemp, setFormTemp] = useState("");
  const [formHumidity, setFormHumidity] = useState("");
  const [formRainfall, setFormRainfall] = useState("");
  const [formWind, setFormWind] = useState("");
  const [formCondition, setFormCondition] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);

    if (search.trim()) params.set("search", search.trim());
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (weatherCondition !== "all")
      params.set("weatherCondition", weatherCondition);
    if (minTemp.trim() !== "") params.set("minTemp", minTemp.trim());
    if (maxTemp.trim() !== "") params.set("maxTemp", maxTemp.trim());

    try {
      const res = await fetch(
        `/api/datasets/${datasetId}/records?${params.toString()}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load weather records.");
        return;
      }
      setRecords(data.records || []);
      setTotalCount(data.pagination?.totalCount ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
      setConditionOptions(data.filterOptions?.weatherConditions || []);
    } catch {
      setError("Network error while querying MongoDB records.");
    } finally {
      setLoading(false);
    }
  }, [
    datasetId,
    page,
    limit,
    sortBy,
    sortOrder,
    search,
    startDate,
    endDate,
    weatherCondition,
    minTemp,
    maxTemp,
  ]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords, refreshKey]);

  function openEditModal(rec: WeatherRecordItem) {
    setFormError(null);
    setEditingRecord(rec);
    const dt = new Date(rec.timestamp);
    const isoLocal = !isNaN(dt.getTime())
      ? dt.toISOString().slice(0, 16)
      : "";
    setFormTimestamp(isoLocal);
    setFormCity(rec.city ?? "");
    setFormTemp(
      rec.temperature !== null && rec.temperature !== undefined
        ? String(rec.temperature)
        : ""
    );
    setFormHumidity(
      rec.humidity !== null && rec.humidity !== undefined
        ? String(rec.humidity)
        : ""
    );
    setFormRainfall(
      rec.rainfall !== null && rec.rainfall !== undefined
        ? String(rec.rainfall)
        : ""
    );
    setFormWind(
      rec.windSpeed !== null && rec.windSpeed !== undefined
        ? String(rec.windSpeed)
        : ""
    );
    setFormCondition(rec.weatherCondition ?? "");
  }

  function openCreateModal() {
    setFormError(null);
    setCreatingRecord(true);
    setFormTimestamp(new Date().toISOString().slice(0, 16));
    setFormCity("");
    setFormTemp("");
    setFormHumidity("");
    setFormRainfall("");
    setFormWind("");
    setFormCondition("");
  }

  async function handleSaveRecord(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    const payload = {
      timestamp: new Date(formTimestamp).toISOString(),
      city: formCity.trim() ? formCity.trim() : null,
      temperature: formTemp.trim() !== "" ? Number(formTemp) : null,
      humidity: formHumidity.trim() !== "" ? Number(formHumidity) : null,
      rainfall: formRainfall.trim() !== "" ? Number(formRainfall) : null,
      windSpeed: formWind.trim() !== "" ? Number(formWind) : null,
      weatherCondition: formCondition.trim() ? formCondition.trim() : null,
    };

    try {
      const url = editingRecord
        ? `/api/datasets/${datasetId}/records/${editingRecord._id}`
        : `/api/datasets/${datasetId}/records`;
      const method = editingRecord ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Could not save weather record.");
        return;
      }

      setEditingRecord(null);
      setCreatingRecord(false);
      onDataMutated();
      fetchRecords();
    } catch {
      setFormError("Network error while saving record.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingRecord) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/datasets/${datasetId}/records/${deletingRecord._id}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        setDeletingRecord(null);
        onDataMutated();
        fetchRecords();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete record.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSort(field: "timestamp" | "temperature") {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  }

  function resetAllFilters() {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setWeatherCondition("all");
    setMinTemp("");
    setMaxTemp("");
    setSortBy("timestamp");
    setSortOrder("desc");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                Weather Record Explorer &amp; Management
              </CardTitle>
              <CardDescription>
                Server-side search, filtering, sorting, and pagination powered
                by MongoDB queries.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetAllFilters}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={openCreateModal}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add Observation
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filter Bar */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1">
              <Label htmlFor="rec-search" className="text-xs">
                Search City / Location
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  id="rec-search"
                  placeholder="e.g. Bengaluru"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="rec-start" className="text-xs">
                From Date
              </Label>
              <Input
                id="rec-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="rec-end" className="text-xs">
                To Date
              </Label>
              <Input
                id="rec-end"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="rec-cond" className="text-xs">
                Weather Condition
              </Label>
              <select
                id="rec-cond"
                value={weatherCondition}
                onChange={(e) => {
                  setWeatherCondition(e.target.value);
                  setPage(1);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs"
              >
                <option value="all">All Conditions</option>
                {conditionOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="rec-min-t" className="text-xs">
                Min Temp (°C)
              </Label>
              <Input
                id="rec-min-t"
                type="number"
                step="0.5"
                placeholder="Min °C"
                value={minTemp}
                onChange={(e) => {
                  setMinTemp(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="rec-max-t" className="text-xs">
                Max Temp (°C)
              </Label>
              <Input
                id="rec-max-t"
                type="number"
                step="0.5"
                placeholder="Max °C"
                value={maxTemp}
                onChange={(e) => {
                  setMaxTemp(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                No Matching Weather Records Found
              </p>
              <p className="text-xs text-slate-500">
                Adjust your search or filters, or add a new weather observation.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSort("timestamp")}
                        className="inline-flex items-center gap-1 font-semibold hover:text-primary"
                      >
                        Timestamp
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 font-semibold">
                      City / Location
                    </th>
                    <th className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSort("temperature")}
                        className="inline-flex items-center gap-1 font-semibold hover:text-primary"
                      >
                        Temperature (°C)
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Humidity (%)</th>
                    <th className="px-3 py-2.5 font-semibold">Rainfall (mm)</th>
                    <th className="px-3 py-2.5 font-semibold">
                      Wind Speed (km/h)
                    </th>
                    <th className="px-3 py-2.5 font-semibold">
                      Weather Condition
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {records.map((rec) => (
                    <tr key={rec._id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-900">
                        {formatDateTime(rec.timestamp)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {rec.city || (
                          <span className="italic text-slate-400">
                            Unspecified
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {formatNumber(rec.temperature, 1, "°C")}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {formatNumber(rec.humidity, 1, "%")}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {formatNumber(rec.rainfall, 1, "mm")}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {formatNumber(rec.windSpeed, 1, "km/h")}
                      </td>
                      <td className="px-3 py-2.5">
                        {rec.weatherCondition ? (
                          <Badge variant="outline" className="font-normal">
                            {rec.weatherCondition}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setInspectingRecord(rec)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="View full record details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(rec)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-primary"
                            title="Edit record"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingRecord(rec)}
                            className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            title="Delete record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Server-Side Pagination Footer */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2 text-xs text-slate-600">
            <div>
              Showing page <span className="font-semibold">{page}</span> of{" "}
              <span className="font-semibold">{totalPages}</span> (
              <span className="font-semibold">
                {totalCount.toLocaleString()}
              </span>{" "}
              total matching records)
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full Record Details Dialog */}
      <Dialog
        open={Boolean(inspectingRecord)}
        onOpenChange={(open) => !open && setInspectingRecord(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Weather Observation Details</DialogTitle>
            <DialogDescription>
              MongoDB document ID: <code>{inspectingRecord?._id}</code>
            </DialogDescription>
          </DialogHeader>
          {inspectingRecord && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-slate-50 p-4 text-xs">
              <div>
                <p className="text-slate-500">Timestamp</p>
                <p className="font-semibold text-slate-900">
                  {formatDateTime(inspectingRecord.timestamp)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Original CSV Row #</p>
                <p className="font-mono font-semibold text-slate-900">
                  Row {inspectingRecord.rawRowNumber}
                </p>
              </div>
              <div>
                <p className="text-slate-500">City / Location</p>
                <p className="font-semibold text-slate-900">
                  {inspectingRecord.city || "null (Unspecified)"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Weather Condition</p>
                <p className="font-semibold text-slate-900">
                  {inspectingRecord.weatherCondition || "null"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Temperature</p>
                <p className="font-mono font-semibold text-slate-900">
                  {formatNumber(inspectingRecord.temperature, 2, "°C")}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Relative Humidity</p>
                <p className="font-mono font-semibold text-slate-900">
                  {formatNumber(inspectingRecord.humidity, 2, "%")}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Rainfall</p>
                <p className="font-mono font-semibold text-slate-900">
                  {formatNumber(inspectingRecord.rainfall, 2, "mm")}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Wind Speed</p>
                <p className="font-mono font-semibold text-slate-900">
                  {formatNumber(inspectingRecord.windSpeed, 2, "km/h")}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setInspectingRecord(null)}
            >
              Close
            </Button>
            {inspectingRecord && (
              <Button
                type="button"
                onClick={() => {
                  const rec = inspectingRecord;
                  setInspectingRecord(null);
                  openEditModal(rec);
                }}
              >
                Edit Record
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Record Modal */}
      <Dialog
        open={Boolean(editingRecord) || creatingRecord}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRecord(null);
            setCreatingRecord(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRecord
                ? `Edit Weather Record (CSV Row #${editingRecord.rawRowNumber})`
                : "Add Weather Observation"}
            </DialogTitle>
            <DialogDescription>
              Leave optional numeric measurements blank to store them as{" "}
              <code>null</code> (never fabricated as zero).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveRecord} className="space-y-3">
            {formError && (
              <div className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                {formError}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="form-ts" className="text-xs">
                  Timestamp *
                </Label>
                <Input
                  id="form-ts"
                  type="datetime-local"
                  value={formTimestamp}
                  onChange={(e) => setFormTimestamp(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="form-city" className="text-xs">
                  City / Location
                </Label>
                <Input
                  id="form-city"
                  placeholder="e.g. Bengaluru"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="form-temp" className="text-xs">
                  Temperature (°C)
                </Label>
                <Input
                  id="form-temp"
                  type="number"
                  step="any"
                  placeholder="Optional (null)"
                  value={formTemp}
                  onChange={(e) => setFormTemp(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="form-hum" className="text-xs">
                  Humidity (%)
                </Label>
                <Input
                  id="form-hum"
                  type="number"
                  step="any"
                  placeholder="Optional (null)"
                  value={formHumidity}
                  onChange={(e) => setFormHumidity(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="form-rain" className="text-xs">
                  Rainfall (mm)
                </Label>
                <Input
                  id="form-rain"
                  type="number"
                  step="any"
                  placeholder="Optional (null)"
                  value={formRainfall}
                  onChange={(e) => setFormRainfall(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="form-wind" className="text-xs">
                  Wind Speed (km/h)
                </Label>
                <Input
                  id="form-wind"
                  type="number"
                  step="any"
                  placeholder="Optional (null)"
                  value={formWind}
                  onChange={(e) => setFormWind(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="form-cond" className="text-xs">
                  Weather Condition
                </Label>
                <Input
                  id="form-cond"
                  placeholder="e.g. Partly Cloudy, Rain, Sunny"
                  value={formCondition}
                  onChange={(e) => setFormCondition(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingRecord(null);
                  setCreatingRecord(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Record"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Record Confirmation Modal */}
      <Dialog
        open={Boolean(deletingRecord)}
        onOpenChange={(open) => !open && setDeletingRecord(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Weather Observation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the weather record from{" "}
              <span className="font-semibold text-slate-900">
                {deletingRecord ? formatDateTime(deletingRecord.timestamp) : ""}
              </span>{" "}
              (CSV Row #{deletingRecord?.rawRowNumber})? Analytics and quality
              counts will automatically recalculate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingRecord(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={submitting}
            >
              {submitting ? "Deleting..." : "Delete Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

