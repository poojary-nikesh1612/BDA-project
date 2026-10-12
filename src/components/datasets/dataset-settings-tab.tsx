"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Trash2,
  CheckCircle2,
  AlertCircle,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

interface DatasetSettingsTabProps {
  dataset: {
    _id: string;
    workspaceId: string;
    name: string;
    originalFilename: string;
    description: string;
    rowCount: number;
    validRowCount: number;
    columns: string[];
    columnMapping: Record<string, string | undefined>;
    availableMetrics: string[];
    createdAt: string;
    updatedAt: string;
  };
  onDatasetUpdated: (updated: { name: string; description: string }) => void;
}

export function DatasetSettingsTab({
  dataset,
  onDatasetUpdated,
}: DatasetSettingsTabProps) {
  const router = useRouter();
  const [name, setName] = useState(dataset.name);
  const [description, setDescription] = useState(dataset.description || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/datasets/${dataset._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Failed to update dataset metadata.",
        });
        return;
      }
      onDatasetUpdated({
        name: data.dataset.name,
        description: data.dataset.description,
      });
      setMessage({
        type: "success",
        text: "Dataset metadata updated.",
      });
    } catch {
      setMessage({
        type: "error",
        text: "Network error while saving settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDataset() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/datasets/${dataset._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push(`/workspaces/${dataset.workspaceId}`);
        router.refresh();
      } else {
        const data = await res.json();
        setMessage({
          type: "error",
          text: data.error || "Failed to delete dataset.",
        });
        setConfirmDeleteOpen(false);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Edit Dataset Metadata
          </CardTitle>
          <CardDescription>
            Rename this dataset or update its analytical notes.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSaveSettings}>
          <CardContent className="space-y-4">
            {message && (
              <div
                className={`flex items-center gap-2 rounded-md border p-3 text-xs ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {message.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ds-settings-name">Dataset Name *</Label>
              <Input
                id="ds-settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ds-settings-desc">Description</Label>
              <textarea
                id="ds-settings-desc"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Dataset Settings"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Schema &amp; Column Mapping Info
            </CardTitle>
            <CardDescription>
              Source file: <code>{dataset.originalFilename}</code> • Uploaded{" "}
              {formatDateTime(dataset.createdAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-700">
                Mapped Normalized Fields:
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-md border bg-slate-50 p-3">
                {Object.entries(dataset.columnMapping || {}).map(
                  ([key, col]) =>
                    col ? (
                      <div key={key}>
                        <span className="text-slate-500">{key}:</span>{" "}
                        <span className="font-mono font-semibold text-slate-900">
                          {col}
                        </span>
                      </div>
                    ) : null
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold text-slate-700">
                Detected CSV Headers ({dataset.columns.length}):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dataset.columns.map((c) => (
                  <Badge key={c} variant="outline" className="font-mono">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-base text-red-900">
              Danger Zone — Delete Dataset
            </CardTitle>
            <CardDescription className="text-red-800/80">
              Permanently remove this dataset and all{" "}
              {dataset.validRowCount.toLocaleString()} associated weather
              records from MongoDB.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmDeleteOpen(true)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Dataset Permanently
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Dataset Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">
                {dataset.name}
              </span>{" "}
              and all{" "}
              <span className="font-semibold">
                {dataset.validRowCount.toLocaleString()} weather records
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteDataset}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

