import { AlertTriangle, Database, Terminal } from "lucide-react";

interface DbSetupBannerProps {
  message?: string;
}

export function DbSetupBanner({ message }: DbSetupBannerProps) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-5 text-amber-950 shadow-sm">
      <div className="flex items-start gap-3.5">
        <div className="rounded-full bg-amber-100 p-2 text-amber-700">
          <Database className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-amber-950">
              MongoDB Atlas Connection Required
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/70 px-2 py-0.5 text-xs font-medium text-amber-900">
              <AlertTriangle className="h-3 w-3" /> Setup Needed
            </span>
          </div>
          <p className="text-sm text-amber-900/90">
            {message ||
              "The database connection string (MONGODB_URI) is not configured yet or the MongoDB cluster could not be reached. No fake or fabricated records are shown."}
          </p>
          <div className="mt-3 rounded-md border border-amber-200 bg-white/90 p-3 text-xs font-mono text-slate-800">
            <div className="mb-1.5 flex items-center gap-1.5 font-sans text-xs font-semibold text-slate-700">
              <Terminal className="h-3.5 w-3.5 text-amber-700" />
              Configure <code className="rounded bg-slate-100 px-1 py-0.5">.env.local</code> in the project root:
            </div>
            <pre className="overflow-x-auto leading-relaxed text-slate-700">
{`MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=weatherAnalyzer
SESSION_COOKIE_NAME=weather_analyzer_session
APP_TIMEZONE=Asia/Kolkata`}
            </pre>
          </div>
          <p className="text-xs text-amber-800">
            After saving <code className="font-semibold">.env.local</code>, restart the Next.js server (<code className="font-semibold">npm run dev</code>) and refresh this page.
          </p>
        </div>
      </div>
    </div>
  );
}

