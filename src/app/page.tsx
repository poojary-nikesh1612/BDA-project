import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CloudSun,
  FileSpreadsheet,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { isDatabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { DbSetupBanner } from "@/components/layout/db-setup-banner";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dbConfigured = isDatabaseConfigured();
  let dbError: string | null = null;

  if (dbConfigured) {
    try {
      const user = await getCurrentUser();
      if (user) {
        redirect("/workspaces");
      }
    } catch (err) {
      dbError =
        err instanceof Error
          ? err.message
          : "Unable to connect to MongoDB Atlas.";
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between bg-grid-pattern">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm">
              <CloudSun className="h-5 w-5" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900">
              Weather Data Analyzer
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild size="sm" className="font-medium">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="rounded-lg bg-blue-600 hover:bg-blue-700 shadow-sm"
            >
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-20">
        {(!dbConfigured || dbError) && (
          <DbSetupBanner message={dbError ?? undefined} />
        )}

        {/* Hero Section */}
        <section className="grid gap-12 lg:grid-cols-12 lg:items-center pt-4">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-semibold text-sky-800 shadow-2xs">
              <CloudSun className="h-3.5 w-3.5 text-sky-600" />
              Meteorological Data Ingestion &amp; Analytics Platform
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl leading-[1.12]">
              Turn Raw Weather CSVs into{" "}
              <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-teal-500 bg-clip-text text-transparent">
                Actionable Climate Insights
              </span>
            </h1>

            <p className="max-w-2xl text-base text-slate-600 sm:text-lg leading-relaxed">
              Upload multi-station weather datasets, automatically map and
              validate columns, clean up missing values or sensor anomalies, and
              explore interactive temperature, rainfall, humidity, and wind
              analytics powered by MongoDB aggregations.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button
                asChild
                size="lg"
                className="h-12 px-7 text-base rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 gap-2"
              >
                <Link href="/register">
                  Start Analyzing Data <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 px-7 text-base rounded-xl bg-white hover:bg-slate-50"
              >
                <Link href="/login">Sign In to Workspace</Link>
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200/80 max-w-lg text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Smart CSV Header Mapping</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Automated Quality Checks</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>MongoDB Aggregations</span>
              </div>
            </div>
          </div>

          {/* Visual Feature Showcase Panel */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-900/5 space-y-5">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-3 rounded-full bg-rose-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs font-semibold text-slate-700">
                    Climate Telemetry Engine
                  </span>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                  Real-Time Pipeline
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50/70 to-white p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-orange-800">
                    <span>Temperature</span>
                    <Thermometer className="h-4 w-4 text-orange-500" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    Hourly &amp; Daily Curves
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Track min, max &amp; average thermal extremes
                  </p>
                </div>

                <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-white p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-indigo-800">
                    <span>Precipitation</span>
                    <CloudRain className="h-4 w-4 text-indigo-500" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    Rainfall Accumulation
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Pinpoint peak rainfall periods in mm
                  </p>
                </div>

                <div className="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50/70 to-white p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-sky-800">
                    <span>Humidity</span>
                    <Droplets className="h-4 w-4 text-sky-500" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    Moisture Profiles
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Monitor relative humidity saturation (%)
                  </p>
                </div>

                <div className="rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50/70 to-white p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-teal-800">
                    <span>Wind &amp; Sky</span>
                    <Wind className="h-4 w-4 text-teal-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    Velocity &amp; Conditions
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Analyze wind speeds &amp; sky categories
                  </p>
                </div>
              </div>

              <div className="rounded-xl border bg-slate-900 p-4 text-xs text-slate-300 space-y-2">
                <div className="flex items-center justify-between text-sky-400 font-semibold">
                  <span>Built-in Data Quality Guardrails</span>
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Automatically isolates invalid timestamps, flags out-of-range
                  sensor spikes, skips duplicate observations, and never
                  replaces missing measurements with fake zeros.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Grid */}
        <section className="space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Everything You Need for Weather Dataset Analysis
            </h2>
            <p className="text-sm text-slate-600">
              Designed for clarity and accuracy—from raw CSV upload to cleaned,
              aggregated visual insights.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="group rounded-2xl border bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Flexible CSV Ingestion
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Upload weather files with any column naming convention. Preview
                rows, map headers to standard meteorological fields, and batch
                import records reliably.
              </p>
            </div>

            <div className="group rounded-2xl border bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Data Quality &amp; Repair
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Spot missing values, out-of-range measurements, duplicate rows,
                and inconsistent category names. Edit or remove bad records
                directly in the browser.
              </p>
            </div>

            <div className="group rounded-2xl border bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Interactive Visual Analytics
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Filter by date range, location, weather condition, or
                temperature thresholds. Every chart and summary metric updates
                from live MongoDB aggregation pipelines.
              </p>
            </div>

            <div className="group rounded-2xl border bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Multi-Workspace Organization
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Keep regional studies, weather stations, and seasonal datasets
                neatly organized inside isolated workspaces with full record
                search and pagination.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/80 bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 font-medium text-slate-700">
            <CloudSun className="h-4 w-4 text-blue-600" />
            <span>Weather Data Analyzer</span>
          </div>
          <p>
            Powered by Next.js, TypeScript &amp; MongoDB Aggregation Pipelines
          </p>
        </div>
      </footer>
    </div>
  );
}
