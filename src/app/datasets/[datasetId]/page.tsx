"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BarChart3,
  TableProperties,
  ShieldCheck,
  Settings,
  Calendar,
  FileSpreadsheet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AnalysisTab } from "@/components/datasets/analysis-tab";
import { DataPreviewTab } from "@/components/datasets/data-preview-tab";
import { DataQualityTab } from "@/components/datasets/data-quality-tab";
import { DatasetSettingsTab } from "@/components/datasets/dataset-settings-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";

interface DatasetFull {
  _id: string;
  workspaceId: string;
  name: string;
  originalFilename: string;
  description: string;
  rowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  duplicateRowCount: number;
  warningCount: number;
  columns: string[];
  columnMapping: Record<string, string | undefined>;
  availableMetrics: string[];
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  importStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceSummary {
  _id: string;
  name: string;
  description: string;
}

const TAB_LABELS: Record<string, string> = {
  analysis: "Analysis",
  preview: "Data Preview",
  quality: "Data Quality",
  settings: "Dataset Settings",
};

export default function DatasetDetailPage() {
  const params = useParams<{ datasetId: string }>();
  const router = useRouter();
  const datasetId = params.datasetId;

  const [username, setUsername] = useState<string | undefined>();
  const [dataset, setDataset] = useState<DatasetFull | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [activeTab, setActiveTab] = useState<string>("analysis");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadDataset = useCallback(async () => {
    setError(null);
    try {
      const [meRes, dsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/datasets/${datasetId}`),
      ]);
      const meData = await meRes.json();
      if (!meData.user) {
        router.push("/login");
        return;
      }
      setUsername(meData.user.username);

      const dsData = await dsRes.json();
      if (!dsRes.ok) {
        setError(dsData.error || "Dataset not found.");
        return;
      }
      setDataset(dsData.dataset);
      setWorkspace(dsData.workspace);
    } catch {
      setError("Network error while loading dataset.");
    } finally {
      setLoading(false);
    }
  }, [datasetId, router]);

  useEffect(() => {
    loadDataset();
  }, [loadDataset]);

  function handleDataMutated() {
    setRefreshKey((k) => k + 1);
    loadDataset();
  }

  return (
    <AppShell
      username={username}
      breadcrumbs={[
        { label: "Workspaces", href: "/workspaces" },
        ...(workspace
          ? [
              {
                label: workspace.name,
                href: `/workspaces/${workspace._id}`,
              },
            ]
          : []),
        {
          label: dataset?.name || "Dataset",
          href: dataset ? `/datasets/${dataset._id}` : undefined,
        },
        { label: TAB_LABELS[activeTab] || "Analysis" },
      ]}
    >
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-12 w-96 rounded-xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        ) : error || !dataset ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 flex items-center justify-between text-sm text-red-800">
              <span>{error || "Dataset not found."}</span>
              <Button asChild variant="outline" size="sm">
                <Link href="/workspaces">Back to Workspaces</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Dataset Header Banner */}
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white via-white to-sky-50/50 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                    {dataset.name}
                  </h1>
                  <Badge variant="success">
                    {dataset.validRowCount.toLocaleString()} stored records
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs bg-white">
                    <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                    {dataset.originalFilename}
                  </Badge>
                </div>
                {dataset.description && (
                  <p className="text-sm text-slate-600">
                    {dataset.description}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:items-end text-xs text-slate-500 gap-1">
                <span className="flex items-center gap-1.5 font-semibold text-slate-800 bg-slate-100/80 px-3 py-1 rounded-full">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  {dataset.dateRangeStart && dataset.dateRangeEnd
                    ? `${formatDateTime(
                        dataset.dateRangeStart,
                        false
                      )} – ${formatDateTime(dataset.dateRangeEnd, false)}`
                    : "No date range"}
                </span>
                <span className="px-1">
                  Uploaded {formatDateTime(dataset.createdAt)}
                </span>
              </div>
            </div>

            {/* Dataset Tabs: Analysis | Data Preview | Data Quality | Dataset Settings */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="space-y-5"
            >
              <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex sm:grid-cols-4 h-auto p-1.5 bg-slate-200/75 rounded-xl">
                <TabsTrigger
                  value="analysis"
                  className="gap-2 py-2.5 px-4 rounded-lg data-[state=active]:text-blue-600"
                >
                  <BarChart3 className="h-4 w-4" />
                  Analysis
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="gap-2 py-2.5 px-4 rounded-lg data-[state=active]:text-blue-600"
                >
                  <TableProperties className="h-4 w-4" />
                  Data Preview
                </TabsTrigger>
                <TabsTrigger
                  value="quality"
                  className="gap-2 py-2.5 px-4 rounded-lg data-[state=active]:text-blue-600"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Data Quality
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="gap-2 py-2.5 px-4 rounded-lg data-[state=active]:text-blue-600"
                >
                  <Settings className="h-4 w-4" />
                  Dataset Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analysis">
                <AnalysisTab
                  datasetId={dataset._id}
                  datasetName={dataset.name}
                  availableMetrics={dataset.availableMetrics}
                  refreshKey={refreshKey}
                />
              </TabsContent>

              <TabsContent value="preview">
                <DataPreviewTab
                  datasetId={dataset._id}
                  refreshKey={refreshKey}
                  onDataMutated={handleDataMutated}
                />
              </TabsContent>

              <TabsContent value="quality">
                <DataQualityTab
                  datasetId={dataset._id}
                  refreshKey={refreshKey}
                  onDataMutated={handleDataMutated}
                />
              </TabsContent>

              <TabsContent value="settings">
                <DatasetSettingsTab
                  dataset={dataset}
                  onDatasetUpdated={(upd) =>
                    setDataset((prev) =>
                      prev
                        ? {
                            ...prev,
                            name: upd.name,
                            description: upd.description,
                          }
                        : null
                    )
                  }
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppShell>
  );
}
