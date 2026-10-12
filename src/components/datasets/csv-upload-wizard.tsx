"use client";

import React, { useState, useRef } from "react";
import Papa from "papaparse";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MAX_CSV_FILE_SIZE_BYTES,
  PREVIEW_ROW_LIMIT,
  suggestColumnMapping,
} from "@/lib/csv-validator";
import {
  ColumnMapping,
  IImportIssuePreview,
  NormalizedFieldKey,
} from "@/models/Dataset";

interface CsvUploadWizardProps {
  workspaceId: string;
  onComplete: (datasetId: string) => void;
  onCancel: () => void;
}

interface ValidationResponse {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  warningCount: number;
  missingValueCount: number;
  headers: string[];
  availableMetrics: string[];
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  issuesPreview: IImportIssuePreview[];
  columnQuality: {
    columnName: string;
    mappedField: string | null;
    detectedType: string;
    nonNullCount: number;
    missingCount: number;
    missingPercentage: number;
    distinctCount: number;
    invalidCount: number;
    outOfRangeCount: number;
  }[];
}

interface ImportSummaryResponse {
  datasetId: string;
  totalParsedRows: number;
  insertedCount: number;
  skippedDuplicateCount: number;
  failedInvalidCount: number;
  warningCount: number;
  storedValidRecordCount: number;
}

const MAPPING_FIELDS: {
  key: NormalizedFieldKey;
  label: string;
  required: boolean;
  helper: string;
}[] = [
  {
    key: "timestamp",
    label: "Timestamp / Date-Time",
    required: true,
    helper: "When the observation was recorded (e.g. YYYY-MM-DD, DD/MM/YYYY)",
  },
  {
    key: "city",
    label: "City / Location / Station",
    required: false,
    helper: "Name of the city or weather station (optional if single site)",
  },
  {
    key: "temperature",
    label: "Temperature (°C)",
    required: false,
    helper: "Air temperature measurement in degrees Celsius",
  },
  {
    key: "humidity",
    label: "Relative Humidity (%)",
    required: false,
    helper: "Moisture percentage in the air (0 - 100%)",
  },
  {
    key: "rainfall",
    label: "Rainfall / Precipitation (mm)",
    required: false,
    helper: "Amount of rain or precipitation in millimetres",
  },
  {
    key: "windSpeed",
    label: "Wind Speed (km/h)",
    required: false,
    helper: "Wind velocity measured in kilometres per hour",
  },
  {
    key: "weatherCondition",
    label: "Weather Condition",
    required: false,
    helper: "Sky description (e.g., Sunny, Rain, Partly Cloudy)",
  },
];

export function CsvUploadWizard({
  workspaceId,
  onComplete,
  onCancel,
}: CsvUploadWizardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [datasetDescription, setDatasetDescription] = useState("");
  const [defaultCity, setDefaultCity] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Parsed preview state (bounded to 20 rows in React state)
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [totalParsedRows, setTotalParsedRows] = useState(0);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});

  // Created Dataset ID & Server validation state
  const [createdDatasetId, setCreatedDatasetId] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResponse | null>(null);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] =
    useState<ImportSummaryResponse | null>(null);

  function handleFileChange(file: File | null) {
    setError(null);
    if (!file) return;

    if (
      !file.name.toLowerCase().endsWith(".csv") &&
      file.type !== "text/csv" &&
      file.type !== "application/vnd.ms-excel"
    ) {
      setError("Please select a valid .csv file.");
      return;
    }

    if (file.size === 0) {
      setError("The selected CSV file is empty.");
      return;
    }

    if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
      setError("CSV file exceeds the maximum allowed size of 15 MB.");
      return;
    }

    setSelectedFile(file);
    if (!datasetName.trim()) {
      const baseName = file.name.replace(/\.csv$/i, "").replace(/[-_]/g, " ");
      setDatasetName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }

    let rowCounter = 0;
    const boundedRows: Record<string, string>[] = [];
    let detectedHeaders: string[] = [];

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      step(results) {
        if (detectedHeaders.length === 0 && results.meta.fields) {
          detectedHeaders = results.meta.fields
            .map((h) => h.trim())
            .filter(Boolean);
        }
        rowCounter += 1;
        if (boundedRows.length < PREVIEW_ROW_LIMIT) {
          boundedRows.push(results.data);
        }
      },
      complete() {
        if (detectedHeaders.length === 0 || rowCounter === 0) {
          setError(
            "No valid CSV headers or data rows were detected in the file."
          );
          return;
        }
        setHeaders(detectedHeaders);
        setPreviewRows(boundedRows);
        setTotalParsedRows(rowCounter);
        setColumnMapping(suggestColumnMapping(detectedHeaders));
      },
      error(err) {
        setError(`Failed to parse CSV file: ${err.message}`);
      },
    });
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0] ?? null;
    handleFileChange(droppedFile);
  }

  async function handleProceedToValidation() {
    setError(null);
    if (!selectedFile) {
      setError("Please select a CSV file first.");
      return;
    }
    if (!datasetName.trim()) {
      setError("Please enter a dataset name.");
      return;
    }
    if (!columnMapping.timestamp) {
      setError("Timestamp column mapping is required.");
      return;
    }

    const hasMeasurement =
      Boolean(columnMapping.temperature) ||
      Boolean(columnMapping.humidity) ||
      Boolean(columnMapping.rainfall) ||
      Boolean(columnMapping.windSpeed) ||
      Boolean(columnMapping.weatherCondition);

    if (!hasMeasurement) {
      setError(
        "Please map at least one weather measurement column (temperature, humidity, rainfall, wind speed, or weather condition)."
      );
      return;
    }

    setValidating(true);
    try {
      let dsId = createdDatasetId;
      if (!dsId) {
        const createRes = await fetch(
          `/api/workspaces/${workspaceId}/datasets`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: datasetName.trim(),
              originalFilename: selectedFile.name,
              description: datasetDescription.trim(),
            }),
          }
        );
        const createData = await createRes.json();
        if (!createRes.ok) {
          setError(createData.error || "Could not initialize dataset record.");
          return;
        }
        dsId = createData.dataset._id as string;
        setCreatedDatasetId(dsId);
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("columnMapping", JSON.stringify(columnMapping));
      if (defaultCity.trim()) {
        formData.append("defaultCity", defaultCity.trim());
      }

      const valRes = await fetch(`/api/datasets/${dsId}/validate`, {
        method: "POST",
        body: formData,
      });
      const valData = await valRes.json();
      if (!valRes.ok) {
        setError(valData.error || "Server validation failed.");
        return;
      }

      setValidationResult(valData.validation);
      setStep(4);
    } catch {
      setError("Network error while validating CSV on the server.");
    } finally {
      setValidating(false);
    }
  }

  async function handleExecuteImport() {
    if (!selectedFile || !createdDatasetId) return;
    setError(null);
    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("columnMapping", JSON.stringify(columnMapping));
      if (defaultCity.trim()) {
        formData.append("defaultCity", defaultCity.trim());
      }

      const res = await fetch(`/api/datasets/${createdDatasetId}/import`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Database import failed.");
        return;
      }

      setImportSummary(data.importSummary);
      setStep(5);
    } catch {
      setError("Network error during MongoDB batch import.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card className="rounded-2xl border-blue-200/80 shadow-lg">
      <CardHeader className="border-b bg-slate-50/80 rounded-t-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">
              Upload &amp; Import Weather CSV Dataset
            </CardTitle>
            <CardDescription>
              Follow the guided steps below to preview, map, validate, and
              import your weather observations.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
            {[
              { n: 1, label: "1. Upload" },
              { n: 2, label: "2. Preview" },
              { n: 3, label: "3. Map Columns" },
              { n: 4, label: "4. Validate" },
              { n: 5, label: "5. Import" },
            ].map((s) => (
              <span
                key={s.n}
                className={`rounded-full px-3 py-1 transition-colors ${
                  step === s.n
                    ? "bg-blue-600 text-white font-semibold shadow-2xs"
                    : step > s.n
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200/70 text-slate-500"
                }`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: UPLOAD & METADATA */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dataset-name">Dataset Name *</Label>
                <Input
                  id="dataset-name"
                  placeholder="e.g. Regional Weather Station Observations"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dataset-desc">Description (optional)</Label>
                <Input
                  id="dataset-desc"
                  placeholder="e.g. Daily temperature, humidity, and rainfall logs"
                  value={datasetDescription}
                  onChange={(e) => setDatasetDescription(e.target.value)}
                  maxLength={500}
                />
              </div>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-10 text-center transition-colors hover:border-blue-500/60 hover:bg-blue-50/20"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Upload className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900">
                Drag and drop your weather CSV file here
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports standard .csv files up to 15 MB (up to 50,000 rows)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              <div className="mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl"
                >
                  Choose CSV File from Computer
                </Button>
              </div>
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-600">
                      {(selectedFile.size / 1024).toFixed(1)} KB •{" "}
                      {totalParsedRows.toLocaleString()} rows •{" "}
                      {headers.length} columns detected
                    </p>
                  </div>
                </div>
                <Badge variant="success">Ready for Preview</Badge>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: PREVIEW */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  CSV Data Preview (Showing first {previewRows.length} of{" "}
                  {totalParsedRows.toLocaleString()} rows)
                </h4>
                <p className="text-xs text-slate-500">
                  Detected {headers.length} columns:{" "}
                  {headers.map((h) => `"${h}"`).join(", ")}
                </p>
              </div>
              <Badge variant="secondary">
                Total Rows: {totalParsedRows.toLocaleString()}
              </Badge>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">#</th>
                    {headers.map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 font-semibold whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-slate-400">
                        {idx + 2}
                      </td>
                      {headers.map((h) => (
                        <td
                          key={h}
                          className="px-3 py-2 whitespace-nowrap text-slate-700"
                        >
                          {row[h] !== undefined && row[h] !== "" ? (
                            row[h]
                          ) : (
                            <span className="italic text-slate-400">empty</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 3: COLUMN MAPPING */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Match Your CSV Columns to Weather Fields
              </h4>
              <p className="text-xs text-slate-500">
                We automatically matched recognized column names. Confirm or
                adjust which column in your CSV corresponds to each weather
                measurement.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {MAPPING_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className="rounded-xl border bg-white p-4 space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={`map-${field.key}`}
                      className="text-xs font-semibold"
                    >
                      {field.label}{" "}
                      {field.required && (
                        <span className="text-red-600">*</span>
                      )}
                    </Label>
                    {columnMapping[field.key] && (
                      <Badge variant="success" className="text-[10px]">
                        Mapped
                      </Badge>
                    )}
                  </div>
                  <select
                    id={`map-${field.key}`}
                    value={columnMapping[field.key] || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setColumnMapping((prev) => ({
                        ...prev,
                        [field.key]: val || undefined,
                      }));
                    }}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">— Not in this CSV —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">{field.helper}</p>
                </div>
              ))}
            </div>

            {!columnMapping.city && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
                <Label
                  htmlFor="default-city"
                  className="text-xs font-semibold text-blue-950"
                >
                  Default City / Station Name (Optional)
                </Label>
                <Input
                  id="default-city"
                  placeholder="e.g. Bengaluru"
                  value={defaultCity}
                  onChange={(e) => setDefaultCity(e.target.value)}
                  maxLength={100}
                  className="bg-white"
                />
                <p className="text-xs text-blue-800">
                  If your CSV file was recorded at a single location and does
                  not have a City column, enter the location name here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: SERVER DATA VALIDATION SUMMARY */}
        {step === 4 && validationResult && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs text-slate-500">Total CSV Rows</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {validationResult.totalRows.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="text-xs text-emerald-800">
                  Ready to Import (Valid)
                </p>
                <p className="text-2xl font-bold text-emerald-700 mt-0.5">
                  {validationResult.validRows.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                <p className="text-xs text-red-800">Rejected (Invalid Rows)</p>
                <p className="text-2xl font-bold text-red-700 mt-0.5">
                  {validationResult.invalidRows.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <p className="text-xs text-amber-800">Duplicates Skipped</p>
                <p className="text-2xl font-bold text-amber-700 mt-0.5">
                  {validationResult.duplicateRows.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <p className="text-xs text-blue-800">Quality Warnings</p>
                <p className="text-2xl font-bold text-blue-700 mt-0.5">
                  {validationResult.warningCount.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-slate-50 p-4 text-xs text-slate-700 space-y-1.5">
              <p className="font-semibold text-slate-900">
                What happens when you click Import:
              </p>
              <p>
                • <strong>{validationResult.validRows.toLocaleString()} valid rows</strong>{" "}
                will be saved to MongoDB. Rows with minor warnings (such as an
                empty cell or an unusual sensor reading) are still imported so
                you can inspect or edit them in the <strong>Data Quality</strong>{" "}
                tab.
              </p>
              <p>
                • <strong>{validationResult.invalidRows.toLocaleString()} broken rows</strong>{" "}
                (such as corrupted dates or text inside number columns) and{" "}
                <strong>{validationResult.duplicateRows.toLocaleString()} duplicate rows</strong>{" "}
                are safely excluded so your charts stay accurate.
              </p>
            </div>

            {validationResult.issuesPreview.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900">
                  Flagged Rows Preview (Showing{" "}
                  {validationResult.issuesPreview.length})
                </h4>
                <div className="max-h-64 overflow-y-auto rounded-xl border">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-slate-700 border-b">
                      <tr>
                        <th className="px-3 py-2">CSV Row</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Field</th>
                        <th className="px-3 py-2">Value in CSV</th>
                        <th className="px-3 py-2">Explanation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {validationResult.issuesPreview.map((iss, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono">
                            Row {iss.rowNumber}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={
                                iss.severity === "fatal"
                                  ? "destructive"
                                  : iss.severity === "duplicate"
                                  ? "secondary"
                                  : "warning"
                              }
                            >
                              {iss.severity === "fatal"
                                ? "REJECTED"
                                : iss.severity === "duplicate"
                                ? "DUPLICATE"
                                : "WARNING"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {iss.field || "Row"}
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
              </div>
            )}
          </div>
        )}

        {/* STEP 5: IMPORT COMPLETE */}
        {step === 5 && importSummary && (
          <div className="py-6 text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">
                Import Complete!
              </h3>
              <p className="text-sm text-slate-600">
                Your weather dataset has been stored in MongoDB and is ready for
                visual analysis.
              </p>
            </div>

            <div className="mx-auto max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              <div className="rounded-xl border bg-slate-50 p-3.5">
                <p className="text-xs text-slate-500">Total CSV Rows</p>
                <p className="text-lg font-bold text-slate-900">
                  {importSummary.totalParsedRows.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                <p className="text-xs text-emerald-800">Imported Records</p>
                <p className="text-lg font-bold text-emerald-700">
                  {importSummary.insertedCount.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                <p className="text-xs text-amber-800">Duplicates Skipped</p>
                <p className="text-lg font-bold text-amber-700">
                  {importSummary.skippedDuplicateCount.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50/60 p-3.5">
                <p className="text-xs text-red-800">Invalid Rejected</p>
                <p className="text-lg font-bold text-red-700">
                  {importSummary.failedInvalidCount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t bg-slate-50/60 px-6 py-4 rounded-b-2xl">
        {step < 5 ? (
          <>
            <div>
              {step === 1 ? (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4)
                  }
                  disabled={validating || importing}
                  className="gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step === 1 && (
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={
                    !selectedFile ||
                    !datasetName.trim() ||
                    headers.length === 0
                  }
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                >
                  Preview CSV <ArrowRight className="h-4 w-4" />
                </Button>
              )}

              {step === 2 && (
                <Button
                  type="button"
                  onClick={() => setStep(3)}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                >
                  Map Columns <ArrowRight className="h-4 w-4" />
                </Button>
              )}

              {step === 3 && (
                <Button
                  type="button"
                  onClick={handleProceedToValidation}
                  disabled={validating || !columnMapping.timestamp}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                >
                  {validating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking Data Quality...
                    </>
                  ) : (
                    <>
                      Validate Data <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}

              {step === 4 && validationResult && (
                <Button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={importing || validationResult.validRows === 0}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing into MongoDB...
                    </>
                  ) : (
                    <>
                      Confirm &amp; Import{" "}
                      {validationResult.validRows.toLocaleString()} Records{" "}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex w-full items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Back to Workspace
            </Button>
            {importSummary && (
              <Button
                type="button"
                onClick={() => onComplete(importSummary.datasetId)}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              >
                Open Analytics Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
