"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Calendar,
  FileSpreadsheet,
  Database,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DbSetupBanner } from "@/components/layout/db-setup-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface WorkspaceItem {
  _id: string;
  name: string;
  description: string;
  datasetCount: number;
  totalRecords: number;
  createdAt: string;
  updatedAt: string;
}

export default function WorkspacesPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string | undefined>();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit Dialog state
  const [editingWs, setEditingWs] = useState<WorkspaceItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [updating, setUpdating] = useState(false);

  // Delete Dialog state
  const [deletingWs, setDeletingWs] = useState<WorkspaceItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    try {
      const [meRes, wsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/workspaces"),
      ]);
      const meData = await meRes.json();
      if (!meData.dbConfigured) {
        setDbError(
          "MongoDB is not configured yet. Please add MONGODB_URI to .env.local."
        );
        return;
      }
      if (!meData.user) {
        router.push("/login");
        return;
      }
      setUsername(meData.user.username);

      const wsData = await wsRes.json();
      if (!wsRes.ok) {
        if (
          wsData.code === "DB_NOT_CONFIGURED" ||
          wsData.code === "DB_CONNECTION_ERROR"
        ) {
          setDbError(wsData.error);
        } else {
          setActionError(wsData.error || "Failed to load workspaces.");
        }
        return;
      }
      setWorkspaces(wsData.workspaces || []);
    } catch {
      setActionError("Network error while loading workspaces.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setActionError(null);

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to create workspace.");
        return;
      }
      setWorkspaces((prev) => [data.workspace, ...prev]);
      setNewName("");
      setNewDesc("");
      setCreateOpen(false);
    } catch {
      setActionError("Network error while creating workspace.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!editingWs || !editName.trim()) return;
    setUpdating(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/workspaces/${editingWs._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to update workspace.");
        return;
      }
      setWorkspaces((prev) =>
        prev.map((w) =>
          w._id === editingWs._id
            ? {
                ...w,
                name: data.workspace.name,
                description: data.workspace.description,
                updatedAt: data.workspace.updatedAt,
              }
            : w
        )
      );
      setEditingWs(null);
    } catch {
      setActionError("Network error while updating workspace.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteWorkspace() {
    if (!deletingWs) return;
    setDeleting(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/workspaces/${deletingWs._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to delete workspace.");
        return;
      }
      setWorkspaces((prev) => prev.filter((w) => w._id !== deletingWs._id));
      setDeletingWs(null);
    } catch {
      setActionError("Network error while deleting workspace.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell username={username} breadcrumbs={[{ label: "Workspaces" }]}>
      <div className="space-y-6">
        {/* Top Hero Banner */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white via-white to-blue-50/50 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Weather Workspaces
            </h1>
            <p className="text-sm text-slate-600">
              Create workspaces to group related weather CSV datasets by region,
              weather station, or time period.
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={Boolean(dbError)}
            className="gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Workspace
          </Button>
        </div>

        {dbError && <DbSetupBanner message={dbError} />}

        {actionError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        ) : workspaces.length === 0 && !dbError ? (
          <Card className="border-dashed bg-white py-14 text-center rounded-2xl">
            <CardContent className="mx-auto max-w-md space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <FolderKanban className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900">
                  No Workspaces Yet
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Create your first workspace (for example, &ldquo;Regional
                  Monsoon Study&rdquo; or &ldquo;City Weather Stations&rdquo;)
                  to start uploading and analyzing CSV datasets.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="gap-2 rounded-xl bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Create Your First Workspace
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <Card
                key={ws._id}
                className="flex flex-col justify-between rounded-2xl border-slate-200/90 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <FolderKanban className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base font-bold text-slate-900 truncate">
                        <Link
                          href={`/workspaces/${ws._id}`}
                          className="hover:text-blue-600 transition-colors"
                        >
                          {ws.name}
                        </Link>
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWs(ws);
                          setEditName(ws.name);
                          setEditDesc(ws.description || "");
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Rename or edit workspace"
                        aria-label={`Edit ${ws.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingWs(ws)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete workspace"
                        aria-label={`Delete ${ws.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2 min-h-[2.5rem] pt-1">
                    {ws.description || "No description provided."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 pt-0 text-xs text-slate-600">
                  <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-slate-50/90 p-3 border">
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {ws.datasetCount}
                        </p>
                        <p className="text-[11px] text-slate-500">Datasets</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Database className="h-4 w-4 text-emerald-600" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {(ws.totalRecords ?? 0).toLocaleString()}
                        </p>
                        <p className="text-[11px] text-slate-500">Records</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Created {formatDateTime(ws.createdAt, false)}
                    </span>
                    <span>Updated {formatDateTime(ws.updatedAt, false)}</span>
                  </div>
                </CardContent>

                <CardFooter className="border-t pt-4">
                  <Button
                    asChild
                    variant="secondary"
                    className="w-full gap-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    <Link href={`/workspaces/${ws._id}`}>
                      Open Workspace <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Create a dedicated workspace to organize related weather CSV
              datasets.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Workspace Name *</Label>
              <Input
                id="ws-name"
                placeholder="e.g. Regional Weather Analysis"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-desc">Description (optional)</Label>
              <textarea
                id="ws-desc"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Describe the region, stations, or study period..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                maxLength={500}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating || !newName.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Workspace"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Workspace Modal */}
      <Dialog
        open={Boolean(editingWs)}
        onOpenChange={(open) => !open && setEditingWs(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
            <DialogDescription>
              Update the workspace name or description.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateWorkspace} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-ws-name">Workspace Name *</Label>
              <Input
                id="edit-ws-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-ws-desc">Description</Label>
              <textarea
                id="edit-ws-desc"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                maxLength={500}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingWs(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updating || !editName.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Workspace Confirmation Modal */}
      <Dialog
        open={Boolean(deletingWs)}
        onOpenChange={(open) => !open && setDeletingWs(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-slate-900">
                {deletingWs?.name}
              </span>
              ? This will also delete all{" "}
              <span className="font-semibold">
                {deletingWs?.datasetCount ?? 0} datasets
              </span>{" "}
              and{" "}
              <span className="font-semibold">
                {(deletingWs?.totalRecords ?? 0).toLocaleString()} weather
                records
              </span>{" "}
              stored in MongoDB. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingWs(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteWorkspace}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Workspace & Datasets"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
