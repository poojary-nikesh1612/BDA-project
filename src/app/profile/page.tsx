"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Calendar,
  FolderKanban,
  FileSpreadsheet,
  Database,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";

interface ProfileData {
  id: string;
  username: string;
  normalizedUsername: string;
  createdAt: string;
  workspaceCount: number;
  datasetCount: number;
  recordCount: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          if (
            data.code === "DB_NOT_CONFIGURED" ||
            data.code === "DB_CONNECTION_ERROR"
          ) {
            setDbError(data.error);
          }
          return;
        }
        setProfile(data.profile);
        setUsernameInput(data.profile.username);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router]);

  async function handleUpdateUsername(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage({
          type: "error",
          text: data.error || "Could not update username.",
        });
        return;
      }
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              username: data.profile.username,
              normalizedUsername: data.profile.normalizedUsername,
            }
          : null
      );
      setSaveMessage({
        type: "success",
        text: "Username updated.",
      });
    } catch {
      setSaveMessage({
        type: "error",
        text: "Network error while updating profile.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <AppShell
      username={profile?.username}
      breadcrumbs={[{ label: "Profile" }]}
    >
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            User Profile
          </h1>
          <p className="text-sm text-slate-500">
            Account details, resource statistics, and session management.
          </p>
        </div>

        {dbError && <DbSetupBanner message={dbError} />}

        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : profile ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-primary" />
                    Workspaces
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold">
                    {profile.workspaceCount}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500">
                    Owned analysis workspaces
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Weather Datasets
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold">
                    {profile.datasetCount}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500">
                    Uploaded CSV datasets
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-600" />
                    Imported Records
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold">
                    {profile.recordCount.toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500">
                    Stored in MongoDB Atlas
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Account Overview</CardTitle>
                  <CardDescription>
                    Your registered account identity and creation timestamp
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold uppercase">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Username</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {profile.username}{" "}
                        <span className="text-xs font-normal text-slate-400">
                          (@{profile.normalizedUsername})
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200/70 text-slate-700">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">
                        Account Created On
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatDateTime(profile.createdAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="destructive"
                    onClick={handleLogout}
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out of Current Session
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Update Display Username
                  </CardTitle>
                  <CardDescription>
                    Change your username while preserving all workspaces and
                    datasets.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleUpdateUsername}>
                  <CardContent className="space-y-4">
                    {saveMessage && (
                      <div
                        className={`flex items-center gap-2 rounded-md border p-3 text-xs ${
                          saveMessage.type === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-red-200 bg-red-50 text-red-800"
                        }`}
                      >
                        {saveMessage.type === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span>{saveMessage.text}</span>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-username">Username</Label>
                      <Input
                        id="edit-username"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        minLength={3}
                        maxLength={32}
                        required
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="submit"
                      disabled={
                        saving || usernameInput.trim() === profile.username
                      }
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Username"
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

