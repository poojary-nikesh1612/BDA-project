"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Info,
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
import { formatDateTime } from "@/lib/utils";
import { IImportIssuePreview } from "@/models/Dataset";

interface DataQualityTabProps {
  datasetId: string;
  refreshKey: number;
  onDataMutated: () => void;
}

interface ColumnQualityRow {
  fieldKey: string;
  columnName: string;
  normalizedField: string;
  detectedType: string;
  nonNullCount: number;
  missingCount: number;
  missingPercentage: number;
  distinctCount: number | null;
  invalidOrFlaggedCount: number;
}

interface FlaggedRecordItem {
  recordId: string;
  rawRowNumber: number;
  timestamp: string;
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
    timestamp: string;
    city?: string | null;
    temperature?: number | null;
    humidity?: number | null;
    rainfall?: number | null;
    windSpeed?: number | null;
    weatherCondition?: string | null;
    rawRowNumber: number;
  };
}

interface QualityResponse {
  summary: {
    totalCsvRows: number;
    validStoredRecords: number;
    invalidRowsRejectedAtImport: number;
    duplicateRowsSkippedAtImport: number;
    totalMissingValuesInStoredRecords: number;
    totalActiveQualityWarnings: number;
    columnCount: number;
    dateRangeStart: string | null;
    dateRangeEnd: string | null;
  };
  issueCountsByType: {
    missing_value: number;
    out_of_range: number;
    inconsistent_category: number;
    unexpected_condition: number;
    import_invalid: number;
    import_duplicate: number;
  };
  columnQualityTable: ColumnQualityRow[];
  flaggedRecords: FlaggedRecordItem[];
  importIssuesPreview: IImportIssuePreview[];
}

export function DataQualityTab({
  datasetId,
  refreshKey,
  onDataMutated,
}: DataQualityTabProps) {
  const [issueFilter, setIssueFilter] = useState<string>("all");
  const [quality, setQuality] = useState<QualityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Repair / Delete Modals
  const [editingIssue, setEditingIssue] = useState<FlaggedRecordItem | null>(
    null
  );
  const [deletingIssue, setDeletingIssue] = useState<FlaggedRecordItem | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Form State
  const [formTimestamp, setFormTimestamp] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formTemp, setFormTemp] = useState("");
  const [formHumidity, setFormHumidity] = useState("");
  const [formRainfall, setFormRainfall] = useState("");
  const [formWind, setFormWind] = useState("");
  const [formCondition, setFormCondition] = useState("");

  const fetchQuality = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/datasets/${datasetId}/quality?issueType=${encodeURIComponent(
          issueFilter
        )}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load data quality report.");
        return;
      }
      setQuality(data.quality);
    } catch {
      setError("Network error while running quality aggregation pipeline.");
    } finally {
      setLoading(false);
    }
  }, [datasetId, issueFilter]);

  useEffect(() => {
    fetchQuality();
  }, [fetchQuality, refreshKey]);

  function openRepairModal(item: FlaggedRecordItem) {
    setModalError(null);
    setEditingIssue(item);
    const rec = item.record;
    const dt = new Date(rec.timestamp);
    setFormTimestamp(
      !isNaN(dt.getTime()) ? dt.toISOString().slice(0, 16) : ""
    );
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

  async function handleSaveRepairedRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!editingIssue) return;
    setSaving(true);
    setModalError(null);

    try {
      const res = await fetch(
        `/api/datasets/${datasetId}/records/${editingIssue.recordId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timestamp: new Date(formTimestamp).toISOString(),
            city: formCity.trim() ? formCity.trim() : null,
            temperature: formTemp.trim() !== "" ? Number(formTemp) : null,
            humidity: formHumidity.trim() !== "" ? Number(formHumidity) : null,
            rainfall: formRainfall.trim() !== "" ? Number(formRainfall) : null,
            windSpeed: formWind.trim() !== "" ? Number(formWind) : null,
            weatherCondition: formCondition.trim()
              ? formCondition.trim()
              : null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || "Failed to update record.");
        return;
      }

      setEditingIssue(null);
      onDataMutated();
      fetchQuality();
    } catch {
      setModalError("Network error while repairing record.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteFlaggedRecord() {
    if (!deletingIssue) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/datasets/${datasetId}/records/${deletingIssue.recordId}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        setDeletingIssue(null);
        onDataMutated();
        fetchQuality();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete record.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Re-run Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Data Quality &amp; Anomaly Inspection
          </h3>
          <p className="text-xs text-slate-500">
            Identify missing values, out-of-range measurements, inconsistent
            categories, and import diagnostics.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchQuality}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Re-run Quality Analysis
        </Button>
      </div>

      {/* Methodology Note */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-950 flex items-start gap-3">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">
            How Data-Quality Checks Work (Import-Time vs. Live MongoDB
            Recalculation):
          </p>
          <p className="text-blue-900">
            • <strong>Import-Time Checks:</strong> Unparseable timestamps,
            non-numeric strings in numeric fields (fatal invalid rows), and
            duplicate dataset observations are caught during CSV upload and
            prevented from corrupting the collection.
          </p>
          <p className="text-blue-900">
            • <strong>Live MongoDB Quality Pipeline:</strong> Missing
            measurements, values outside plausible physical ranges (e.g., Temp{" "}
            <code>[-50, 58] °C</code>, Humidity <code>[0, 100] %</code>),
            inconsistent category capitalization, and unexpected weather
            conditions are recalculated directly from your stored MongoDB
            records. Editing or deleting a flagged record below immediately
            updates all metrics.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : quality ? (
        <>
          {/* Quality Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">
                  Total CSV Rows / Stored Valid
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {quality.summary.totalCsvRows.toLocaleString()} /{" "}
                  <span className="text-emerald-600">
                    {quality.summary.validStoredRecords.toLocaleString()}
                  </span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {quality.summary.columnCount} columns in schema
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">
                  Invalid / Duplicates (Import)
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  <span className="text-red-600">
                    {quality.summary.invalidRowsRejectedAtImport}
                  </span>{" "}
                  /{" "}
                  <span className="text-amber-600">
                    {quality.summary.duplicateRowsSkippedAtImport}
                  </span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Rejected fatal rows &amp; skipped duplicates
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">
                  Total Missing Values (Live)
                </p>
                <p className="text-2xl font-bold text-amber-700 mt-1">
                  {quality.summary.totalMissingValuesInStoredRecords.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {quality.summary.totalActiveQualityWarnings} total active
                  quality warnings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Date Range Coverage</p>
                <p className="text-sm font-bold text-slate-900 mt-1.5">
                  {quality.summary.dateRangeStart
                    ? formatDateTime(quality.summary.dateRangeStart, false)
                    : "N/A"}{" "}
                  →{" "}
                  {quality.summary.dateRangeEnd
                    ? formatDateTime(quality.summary.dateRangeEnd, false)
                    : "N/A"}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Verified MongoDB Date bounds
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Column-Level Quality Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Column-Level Data Quality Summary
              </CardTitle>
              <CardDescription>
                Completeness, data types, distinct cardinality, and out-of-range
                counts calculated across{" "}
                {quality.summary.validStoredRecords.toLocaleString()} stored
                records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">
                        CSV Column / Field
                      </th>
                      <th className="px-3 py-2.5 font-semibold">
                        Detected Data Type
                      </th>
                      <th className="px-3 py-2.5 font-semibold">
                        Non-Null Count
                      </th>
                      <th className="px-3 py-2.5 font-semibold">
                        Missing Count
                      </th>
                      <th className="px-3 py-2.5 font-semibold">Missing %</th>
                      <th className="px-3 py-2.5 font-semibold">
                        Distinct Values
                      </th>
                      <th className="px-3 py-2.5 font-semibold">
                        Out-of-Range Count
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {quality.columnQualityTable.map((col) => (
                      <tr key={col.fieldKey} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {col.normalizedField}{" "}
                          <span className="font-mono text-[11px] text-slate-400">
                            ({col.columnName})
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="secondary" className="font-mono">
                            {col.detectedType}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-emerald-700">
                          {col.nonNullCount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 font-mono">
                          {col.missingCount > 0 ? (
                            <span className="font-semibold text-amber-700">
                              {col.missingCount.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono">
                          {col.missingPercentage}%
                        </td>
                        <td className="px-3 py-2.5 font-mono">
                          {col.distinctCount !== null
                            ? col.distinctCount.toLocaleString()
                            : "Continuous"}
                        </td>
                        <td className="px-3 py-2.5 font-mono">
                          {col.invalidOrFlaggedCount > 0 ? (
                            <Badge variant="warning">
                              {col.invalidOrFlaggedCount} out of range
                            </Badge>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Problematic Record Inspection (Live MongoDB Records) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">
                    Problematic Record Inspection &amp; Remediation
                  </CardTitle>
                  <CardDescription>
                    Inspect stored records flagged for missing values,
                    out-of-range measurements, or non-standard categories, and
                    edit or delete them directly.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="issue-type-filter" className="text-xs whitespace-nowrap">
                    Filter by Issue:
                  </Label>
                  <select
                    id="issue-type-filter"
                    value={issueFilter}
                    onChange={(e) => setIssueFilter(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                  >
                    <option value="all">
                      All Active Issues (
                      {quality.summary.totalActiveQualityWarnings})
                    </option>
                    <option value="missing_value">
                      Missing Values ({quality.issueCountsByType.missing_value})
                    </option>
                    <option value="out_of_range">
                      Out of Plausible Range (
                      {quality.issueCountsByType.out_of_range})
                    </option>
                    <option value="inconsistent_category">
                      Inconsistent Category Formatting (
                      {quality.issueCountsByType.inconsistent_category})
                    </option>
                    <option value="unexpected_condition">
                      Unexpected Weather Condition (
                      {quality.issueCountsByType.unexpected_condition})
                    </option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {quality.flaggedRecords.length === 0 ? (
                <div className="rounded-lg border border-dashed py-10 text-center space-y-2">
                  <ShieldCheck className="mx-auto h-8 w-8 text-emerald-600" />
                  <p className="text-sm font-semibold text-slate-900">
                    No Stored Records Flagged for Selected Issue Filter
                  </p>
                  <p className="text-xs text-slate-500">
                    All stored records satisfy this data-quality check.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-3 py-2.5">CSV Row</th>
                        <th className="px-3 py-2.5">Timestamp &amp; City</th>
                        <th className="px-3 py-2.5">Issue Type</th>
                        <th className="px-3 py-2.5">Field</th>
                        <th className="px-3 py-2.5">Original Value</th>
                        <th className="px-3 py-2.5">Diagnostic Reason</th>
                        <th className="px-3 py-2.5 text-right">
                          Remediate Record
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {quality.flaggedRecords.map((item, idx) => (
                        <tr
                          key={`${item.recordId}-${item.field}-${idx}`}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-3 py-2.5 font-mono">
                            Row #{item.rawRowNumber}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="font-medium text-slate-900">
                              {formatDateTime(item.timestamp)}
                            </span>
                            {item.city && (
                              <span className="ml-1.5 text-slate-500">
                                ({item.city})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="warning">{item.issueType}</Badge>
                          </td>
                          <td className="px-3 py-2.5 font-mono">
                            {item.field}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-amber-900">
                            {item.originalValue}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {item.message}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => openRepairModal(item)}
                              >
                                <Pencil className="h-3 w-3" />
                                Edit / Fix
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => setDeletingIssue(item)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Import-Time Rejected & Duplicate Diagnostics */}
          {quality.importIssuesPreview.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Import-Time Rejected &amp; Duplicate Rows Log
                </CardTitle>
                <CardDescription>
                  Rows that were blocked from import due to fatal format errors
                  or skipped as duplicates during CSV upload.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 border-b bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-3 py-2">CSV Row</th>
                        <th className="px-3 py-2">Classification</th>
                        <th className="px-3 py-2">Issue Type</th>
                        <th className="px-3 py-2">Original Value</th>
                        <th className="px-3 py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {quality.importIssuesPreview.map((iss, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-mono">
                            Row #{iss.rowNumber}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={
                                iss.severity === "fatal"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {iss.severity.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {iss.issueType}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600">
                            {iss.originalValue || "empty"}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {iss.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {/* Edit / Repair Record Modal */}
      <Dialog
        open={Boolean(editingIssue)}
        onOpenChange={(open) => !open && setEditingIssue(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remediate Flagged Record (CSV Row #{editingIssue?.rawRowNumber})
            </DialogTitle>
            <DialogDescription>
              Flagged reason:{" "}
              <span className="font-semibold text-amber-800">
                {editingIssue?.message}
              </span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveRepairedRecord} className="space-y-3">
            {modalError && (
              <div className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                {modalError}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="rep-ts" className="text-xs">
                  Timestamp *
                </Label>
                <Input
                  id="rep-ts"
                  type="datetime-local"
                  value={formTimestamp}
                  onChange={(e) => setFormTimestamp(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rep-city" className="text-xs">
                  City / Location
                </Label>
                <Input
                  id="rep-city"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rep-temp" className="text-xs">
                  Temperature (°C) [-50 to 58]
                </Label>
                <Input
                  id="rep-temp"
                  type="number"
                  step="any"
                  value={formTemp}
                  onChange={(e) => setFormTemp(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rep-hum" className="text-xs">
                  Humidity (%) [0 to 100]
                </Label>
                <Input
                  id="rep-hum"
                  type="number"
                  step="any"
                  value={formHumidity}
                  onChange={(e) => setFormHumidity(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rep-rain" className="text-xs">
                  Rainfall (mm) [0 to 500]
                </Label>
                <Input
                  id="rep-rain"
                  type="number"
                  step="any"
                  value={formRainfall}
                  onChange={(e) => setFormRainfall(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rep-wind" className="text-xs">
                  Wind Speed (km/h) [0 to 250]
                </Label>
                <Input
                  id="rep-wind"
                  type="number"
                  step="any"
                  value={formWind}
                  onChange={(e) => setFormWind(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="rep-cond" className="text-xs">
                  Weather Condition (e.g. Clear, Sunny, Partly Cloudy, Rain,
                  Thunderstorm)
                </Label>
                <Input
                  id="rep-cond"
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
                onClick={() => setEditingIssue(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Save Correction & Recalculate"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Flagged Record Modal */}
      <Dialog
        open={Boolean(deletingIssue)}
        onOpenChange={(open) => !open && setDeletingIssue(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Flagged Weather Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently remove CSV Row #
              {deletingIssue?.rawRowNumber} from this dataset? All quality
              metrics and analytics will automatically update.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingIssue(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteFlaggedRecord}
              disabled={saving}
            >
              {saving ? "Deleting..." : "Delete Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

