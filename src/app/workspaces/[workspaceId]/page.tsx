"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  Calendar,
  Pencil,
  Trash2,
  ArrowRight,
  AlertCircle,
  FolderKanban,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CsvUploadWizard } from "@/components/datasets/csv-upload-wizard";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";

interface WorkspaceDetail {
  _id: string;
  name: string;
  description: string;
  datasetCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DatasetItem {
  _id: string;
  name: string;
  originalFilename: string;
  description: string;
  rowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  duplicateRowCount: number;
  warningCount: number;
  availableMetrics: string[];
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  importStatus: "pending" | "importing" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
}

const METRIC_LABELS: Record<string, string> = {
  temperature: "Temperature (°C)",
  humidity: "Humidity (%)",
  rainfall: "Rainfall (mm)",
  windSpeed: "Wind Speed (km/h)",
  weatherCondition: "Weather Condition",
};

export default function WorkspaceDetailPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const workspaceId = params.workspaceId;

  const [username, setUsername] = useState<string | undefined>();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadWizard, setShowUploadWizard] = useState(false);

  // Edit Dataset modal
  const [editingDataset, setEditingDataset] = useState<DatasetItem | null>(
    null
  );
  const [editDsName, setEditDsName] = useState("");
  const [editDsDesc, setEditDsDesc] = useState("");
  const [savingDs, setSavingDs] = useState(false);

  // Delete Dataset modal
  const [deletingDataset, setDeletingDataset] = useState<DatasetItem | null>(
    null
  );
  const [deletingDs, setDeletingDs] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, wsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/workspaces/${workspaceId}`),
      ]);
      const meData = await meRes.json();
      if (!meData.user) {
        router.push("/login");
        return;
      }
      setUsername(meData.user.username);

      const wsData = await wsRes.json();
      if (!wsRes.ok) {
        setError(wsData.error || "Workspace could not be loaded.");
        return;
      }
      setWorkspace(wsData.workspace);
      setDatasets(wsData.datasets || []);
    } catch {
      setError("Network error while loading workspace.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, router]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  async function handleUpdateDataset(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDataset || !editDsName.trim()) return;
    setSavingDs(true);
    try {
      const res = await fetch(`/api/datasets/${editingDataset._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editDsName.trim(),
          description: editDsDesc.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update dataset.");
        return;
      }
      setDatasets((prev) =>
        prev.map((d) =>
          d._id === editingDataset._id
            ? {
                ...d,
                name: data.dataset.name,
                description: data.dataset.description,
              }
            : d
        )
      );
      setEditingDataset(null);
    } finally {
      setSavingDs(false);
    }
  }

  async function handleDeleteDataset() {
    if (!deletingDataset) return;
    setDeletingDs(true);
    try {
      const res = await fetch(`/api/datasets/${deletingDataset._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDatasets((prev) =>
          prev.filter((d) => d._id !== deletingDataset._id)
        );
        setDeletingDataset(null);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete dataset.");
      }
    } finally {
      setDeletingDs(false);
    }
  }

  return (
    <AppShell
      username={username}
      breadcrumbs={[
        { label: "Workspaces", href: "/workspaces" },
        { label: workspace?.name || "Workspace" },
      ]}
    >
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <div className="grid gap-6 sm:grid-cols-2">
              <Skeleton className="h-60 w-full rounded-2xl" />
              <Skeleton className="h-60 w-full rounded-2xl" />
            </div>
          </div>
        ) : error && !workspace ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-sm text-red-800 flex items-center justify-between">
              <span>{error}</span>
              <Button asChild variant="outline" size="sm">
                <Link href="/workspaces">Back to Workspaces</Link>
              </Button>
            </CardContent>
          </Card>
        ) : workspace ? (
          <>
            {/* Workspace Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white via-white to-sky-50/60 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                      {workspace.name}
                    </h1>
                    <Badge variant="secondary" className="ml-1">
                      {datasets.length}{" "}
                      {datasets.length === 1 ? "Dataset" : "Datasets"}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 max-w-2xl">
                    {workspace.description ||
                      "Upload weather CSV files to store, validate, and analyze meteorological observations."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    onClick={() => setShowUploadWizard((prev) => !prev)}
                    className="gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-sm"
                  >
                    <Upload className="h-4 w-4" />
                    {showUploadWizard
                      ? "Close CSV Uploader"
                      : "Upload Weather CSV"}
                  </Button>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* CSV Upload Wizard */}
            {showUploadWizard && (
              <CsvUploadWizard
                workspaceId={workspace._id}
                onCancel={() => {
                  setShowUploadWizard(false);
                  loadWorkspace();
                }}
                onComplete={(newDatasetId) => {
                  router.push(`/datasets/${newDatasetId}`);
                }}
              />
            )}

            {/* Datasets List */}
            {datasets.length === 0 && !showUploadWizard ? (
              <Card className="border-dashed bg-white py-14 text-center rounded-2xl">
                <CardContent className="mx-auto max-w-md space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <FileSpreadsheet className="h-7 w-7" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-slate-900">
                      No Weather Datasets Uploaded Yet
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Upload a CSV file containing weather observations (such as
                      timestamps, temperatures, rainfall, humidity, or wind
                      speed) to start analyzing trends and inspecting data
                      quality.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button
                      onClick={() => setShowUploadWizard(true)}
                      className="gap-2 rounded-xl bg-blue-600 hover:bg-blue-700"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Weather CSV
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {datasets.map((ds) => (
                  <Card
                    key={ds._id}
                    className="flex flex-col justify-between rounded-2xl border-slate-200/90 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg font-bold text-slate-900">
                            <Link
                              href={`/datasets/${ds._id}`}
                              className="hover:text-blue-600 transition-colors"
                            >
                              {ds.name}
                            </Link>
                          </CardTitle>
                          <p className="text-xs font-mono text-slate-500 mt-1">
                            Source: {ds.originalFilename}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant={
                              ds.importStatus === "completed"
                                ? "success"
                                : ds.importStatus === "failed"
                                ? "destructive"
                                : "warning"
                            }
                          >
                            {ds.importStatus}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDataset(ds);
                              setEditDsName(ds.name);
                              setEditDsDesc(ds.description || "");
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Rename or edit dataset metadata"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingDataset(ds)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete dataset"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {ds.description && (
                        <CardDescription className="pt-1">
                          {ds.description}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-4 text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl border bg-slate-50/80 p-3">
                        <div>
                          <p className="text-[11px] text-slate-500">
                            Stored Records
                          </p>
                          <p className="text-sm font-bold text-emerald-700 mt-0.5">
                            {ds.validRowCount.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500">
                            Invalid Rows
                          </p>
                          <p className="text-sm font-bold text-red-600 mt-0.5">
                            {ds.invalidRowCount.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500">
                            Duplicates
                          </p>
                          <p className="text-sm font-bold text-amber-600 mt-0.5">
                            {ds.duplicateRowCount.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500">
                            Warnings
                          </p>
                          <p className="text-sm font-bold text-blue-600 mt-0.5">
                            {(ds.warningCount ?? 0).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-slate-500">
                          Available Weather Measurements:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {ds.availableMetrics.length > 0 ? (
                            ds.availableMetrics.map((m) => (
                              <Badge
                                key={m}
                                variant="outline"
                                className="bg-white font-normal text-slate-700"
                              >
                                {METRIC_LABELS[m] || m}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">
                              No measurements imported yet
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-500 border-t">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {ds.dateRangeStart && ds.dateRangeEnd
                            ? `${formatDateTime(
                                ds.dateRangeStart,
                                false
                              )} – ${formatDateTime(ds.dateRangeEnd, false)}`
                            : "No date range"}
                        </span>
                        <span>
                          Uploaded {formatDateTime(ds.createdAt, false)}
                        </span>
                      </div>
                    </CardContent>

                    <CardFooter className="border-t pt-4">
                      <Button
                        asChild
                        className="w-full gap-2 rounded-xl bg-blue-600 hover:bg-blue-700"
                      >
                        <Link href={`/datasets/${ds._id}`}>
                          Explore Analytics &amp; Data Quality{" "}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Edit Dataset Metadata Modal */}
      <Dialog
        open={Boolean(editingDataset)}
        onOpenChange={(open) => !open && setEditingDataset(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Dataset Metadata</DialogTitle>
            <DialogDescription>
              Rename this dataset or update its description.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateDataset} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-ds-name">Dataset Name *</Label>
              <Input
                id="edit-ds-name"
                value={editDsName}
                onChange={(e) => setEditDsName(e.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-ds-desc">Description</Label>
              <textarea
                id="edit-ds-desc"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={editDsDesc}
                onChange={(e) => setEditDsDesc(e.target.value)}
                maxLength={500}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingDataset(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingDs || !editDsName.trim()}>
                {savingDs ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dataset Confirmation Modal */}
      <Dialog
        open={Boolean(deletingDataset)}
        onOpenChange={(open) => !open && setDeletingDataset(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Weather Dataset</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-slate-900">
                {deletingDataset?.name}
              </span>{" "}
              and all{" "}
              <span className="font-semibold">
                {(deletingDataset?.validRowCount ?? 0).toLocaleString()}{" "}
                imported weather records
              </span>{" "}
              from MongoDB?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingDataset(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteDataset}
              disabled={deletingDs}
            >
              {deletingDs ? "Deleting..." : "Delete Dataset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
