"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CloudSun,
  FolderKanban,
  User,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AppShellProps {
  children: React.ReactNode;
  username?: string;
  breadcrumbs?: BreadcrumbItem[];
}

const SIDEBAR_STORAGE_KEY = "weather_analyzer_sidebar_open";

// Module-level cache so SPA route transitions preserve state immediately without flicker
let cachedSidebarOpen = true;
let cachedUsername = "";

export function AppShell({
  children,
  username,
  breadcrumbs = [],
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved === "false") {
        cachedSidebarOpen = false;
        return false;
      }
      if (saved === "true") {
        cachedSidebarOpen = true;
        return true;
      }
    }
    return cachedSidebarOpen;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [displayUsername, setDisplayUsername] = useState<string>(
    username || cachedUsername
  );

  useEffect(() => {
    if (username) {
      cachedUsername = username;
      setDisplayUsername(username);
    }
  }, [username]);

  function toggleSidebar(nextState: boolean) {
    cachedSidebarOpen = nextState;
    setSidebarOpen(nextState);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextState));
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      cachedUsername = "";
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const navItems = [
    {
      label: "Workspaces",
      description: "Datasets & Analytics",
      href: "/workspaces",
      icon: FolderKanban,
      active:
        pathname.startsWith("/workspaces") || pathname.startsWith("/datasets"),
    },
    {
      label: "Account Profile",
      description: "Settings & Usage",
      href: "/profile",
      icon: User,
      active: pathname.startsWith("/profile"),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/80 flex">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Compact Collapsible Sidebar (256px / w-64) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-slate-900 text-slate-100 transition-all duration-200 ease-in-out flex flex-col justify-between shadow-xl md:shadow-none",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          sidebarOpen
            ? "md:static md:translate-x-0 md:w-64"
            : "md:static md:-translate-x-full md:w-0 md:overflow-hidden"
        )}
      >
        <div className="w-64">
          {/* Brand Header + Close Button */}
          <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
            <Link
              href="/workspaces"
              className="flex items-center gap-2.5 group min-w-0"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-sm">
                <CloudSun className="h-4 w-4" />
              </div>
              <div className="truncate">
                <span className="block text-sm font-bold tracking-tight text-white truncate">
                  Weather Analyzer
                </span>
                <span className="block text-[10px] font-medium text-slate-400 truncate">
                  Climate Intelligence
                </span>
              </div>
            </Link>

            {/* Desktop Collapse Button */}
            <button
              type="button"
              onClick={() => toggleSidebar(false)}
              className="hidden md:inline-flex rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex md:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Close menu"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 p-3">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Navigation
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    item.active
                      ? "bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-md shadow-blue-600/20"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      item.active ? "text-white" : "text-slate-400"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block leading-tight truncate">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "block text-[11px] leading-tight mt-0.5 truncate",
                        item.active ? "text-blue-100" : "text-slate-400"
                      )}
                    >
                      {item.description}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer — always shows Sign Out inside authenticated AppShell */}
        <div className="w-64 border-t border-slate-800 p-3.5 bg-slate-900/50">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 px-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold uppercase text-sky-300 border border-sky-500/30">
                {displayUsername ? displayUsername.slice(0, 2) : <User className="h-3.5 w-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">
                  {displayUsername || "Account"}
                </p>
                <p className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Online
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs justify-center gap-2 border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-800 hover:text-white"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              {loggingOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Bar with Sidebar Toggle + Breadcrumbs */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile Menu Open Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex md:hidden items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Open navigation menu"
              title="Open navigation menu"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>

            {/* Desktop Sidebar Open/Close Toggle Button */}
            <button
              type="button"
              onClick={() => toggleSidebar(!sidebarOpen)}
              className="hidden md:inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>

            <nav
              aria-label="Breadcrumb"
              className="flex items-center space-x-1.5 text-sm min-w-0 overflow-x-auto py-1"
            >
              {breadcrumbs.length === 0 ? (
                <span className="font-semibold text-slate-800">
                  Weather Data Analyzer
                </span>
              ) : (
                breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={`${crumb.label}-${idx}`}>
                      {idx > 0 && (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      {crumb.href && !isLast ? (
                        <Link
                          href={crumb.href}
                          className="truncate rounded-md px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            "truncate px-2 py-0.5",
                            isLast
                              ? "rounded-md bg-slate-100 font-semibold text-slate-900"
                              : "text-slate-500"
                          )}
                        >
                          {crumb.label}
                        </span>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </nav>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
