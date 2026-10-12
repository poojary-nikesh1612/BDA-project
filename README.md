# Weather Data Analyzer

**Full-Stack Meteorological CSV Ingestion, Data Quality Inspection & MongoDB Analytics Platform**

---

## 1. Project Overview

**Weather Data Analyzer** is a full-stack web application built with **Next.js (App Router)**, **TypeScript**, **MongoDB Atlas**, **Mongoose**, **Tailwind CSS**, **shadcn/ui**, and **Recharts**.

It enables users to create workspaces, upload multi-station weather CSV datasets with varied column headers, validate and remediate data-quality anomalies, batch-import observations into MongoDB with dataset-scoped idempotency, and explore interactive climate analytics powered by server-side MongoDB aggregation pipelines.

---

## 2. Main Features

1. **Database-Backed Session Authentication:** Registration, login, logout, bcrypt password hashing, cryptographically secure random session tokens, SHA-256 hashed session storage in MongoDB, and HTTP-only cookies.
2. **User Profile:** Displays account details, creation timestamp, workspace count, dataset count, total imported records, and username management.
3. **Workspace Isolation:** Create, view, rename, edit, and delete workspaces with cascading cleanup of associated datasets and weather records.
4. **5-Step CSV Ingestion Pipeline:**
   - **Step 1 (Upload):** Drag-and-drop CSV upload with size and content validation.
   - **Step 2 (Preview):** Bounded client preview of the first 20 rows, detected headers, and total row count.
   - **Step 3 (Column Mapping):** Automatic header alias recognition (`timestamp`, `city`, `temperature`, `humidity`, `rainfall`, `windSpeed`, `weatherCondition`) plus optional default city.
   - **Step 4 (Server Data Validation):** Detects missing timestamps, invalid dates, non-numeric values, missing measurements, values outside plausible physical ranges, dataset-scoped duplicates, and inconsistent weather condition categories.
   - **Step 5 (Batched Idempotent Import):** Inserts valid records in batches of 500 using MongoDB `bulkWrite` upserts keyed by `{ datasetId, dedupeKey }`.
5. **Interactive MongoDB Analytics Dashboard:**
   - Global filters (date range, city/location, weather condition, min/max temperature, time grouping granularity).
   - Summary cards (total records in analysis, average/min/max temperature, average humidity, total rainfall, average wind speed, hottest and coldest observations).
   - Responsive Recharts visualizations for Temperature Trends (`°C`), Rainfall Analysis (`mm`), Humidity Trends (`%`), Wind Speed Trends (`km/h`), and Weather-Condition Distribution.
6. **Data Quality Analysis & Remediation:**
   - Distinguishes import-time rejected/duplicate rows from live MongoDB quality warnings.
   - Column-level completeness, data type, distinct cardinality, and out-of-range counts calculated via MongoDB aggregations.
   - Filterable inspection of problematic records (`missing_value`, `out_of_range`, `inconsistent_category`, `unexpected_condition`) with inline record editing, deletion, and quality recalculation.
7. **Server-Side Weather Record Explorer:**
   - Search by city, filter by date range, condition, and temperature bounds, sort by timestamp or temperature, paginate on the server, and add/edit/delete individual observations.

---

## 3. Technology Stack

- **Framework:** Next.js 14 (App Router, Server & Client Components, Route Handlers)
- **Language:** TypeScript (Strict Mode)
- **Database:** MongoDB Atlas + Mongoose 8
- **Styling & UI:** Tailwind CSS, shadcn/ui primitives (Radix UI), Lucide React icons
- **Validation & Forms:** Zod, React Hook Form
- **CSV Processing:** Papa Parse
- **Data Visualization:** Recharts
- **Security:** `bcryptjs`, Node `crypto` SHA-256 session token hashing, HTTP-only cookies, rate limiting, security headers
- **Testing:** Vitest

---

## 4. Application Architecture

```text
e:\bda
├── src/
│   ├── app/
│   │   ├── api/                         # Next.js server-side Route Handlers
│   │   │   ├── auth/                    # register, login, logout, me
│   │   │   ├── profile/                 # GET & PATCH user profile
│   │   │   ├── workspaces/              # CRUD workspaces & workspace datasets
│   │   │   └── datasets/[datasetId]/    # validate, import, records, quality, analytics/*
│   │   ├── login/                       # Login page
│   │   ├── register/                    # Registration page
│   │   ├── profile/                     # User profile page
│   │   ├── workspaces/                  # Workspaces list & workspace detail pages
│   │   └── datasets/[datasetId]/        # Dataset tabs (Analysis, Preview, Quality, Settings)
│   ├── components/
│   │   ├── datasets/                    # CSV wizard, Analysis, Preview, Quality, Settings tabs
│   │   ├── layout/                      # AppShell sidebar/breadcrumbs & DbSetupBanner
│   │   └── ui/                          # Reusable shadcn/ui components
│   ├── lib/
│   │   ├── env.ts                       # Server environment validation
│   │   ├── db.ts                        # Cached Mongoose connection utility
│   │   ├── auth.ts                      # Password hashing & session token management
│   │   ├── api-helpers.ts               # Ownership verification & error responses
│   │   ├── csv-validator.ts             # CSV header normalization, mapping & validation engine
│   │   ├── analytics-service.ts         # MongoDB aggregation pipelines & live quality checks
│   │   └── utils.ts                     # Formatting, ObjectId validation & rate limiting
│   └── models/
│       ├── User.ts                      # User schema & model
│       ├── Session.ts                   # Session schema & TTL index
│       ├── Workspace.ts                 # Workspace schema & model
│       ├── Dataset.ts                   # Dataset metadata & bounded issue preview
│       └── WeatherRecord.ts             # Weather observation documents & compound indexes
└── tests/
    └── unit.test.ts                     # Vitest unit test suite
```

---

## 5. Database Schema & Indexes

1. **`User` (`users`)**
   - Fields: `username`, `normalizedUsername` (unique index), `passwordHash` (excluded from JSON serialization), `createdAt`, `updatedAt`.
2. **`Session` (`sessions`)**
   - Fields: `userId`, `tokenHash` (unique index), `expiresAt` (TTL index + application-level expiry verification), `createdAt`.
3. **`Workspace` (`workspaces`)**
   - Fields: `name`, `description`, `ownerId`, `createdAt`, `updatedAt`.
   - Indexes: `{ ownerId: 1, createdAt: -1 }`.
4. **`Dataset` (`datasets`)**
   - Fields: `name`, `originalFilename`, `description`, `workspaceId`, `ownerId`, `rowCount`, `validRowCount`, `invalidRowCount`, `duplicateRowCount`, `warningCount`, `columns`, `columnMapping`, `defaultCity`, `availableMetrics`, `dateRangeStart`, `dateRangeEnd`, `importStatus`, `importIssuePreview` (bounded to $\le 100$ items), `createdAt`, `updatedAt`.
   - Indexes: `{ workspaceId: 1, ownerId: 1, createdAt: -1 }`.
5. **`WeatherRecord` (`weatherrecords`)**
   - Fields: `datasetId`, `workspaceId`, `ownerId`, `timestamp` (`Date`), `city`, `temperature`, `humidity`, `rainfall`, `windSpeed`, `weatherCondition`, `rawRowNumber`, `dedupeKey`, `createdAt`, `updatedAt`.
   - Indexes:
     - `{ datasetId: 1, timestamp: 1 }`
     - `{ datasetId: 1, city: 1, timestamp: 1 }`
     - `{ datasetId: 1, temperature: 1 }`
     - `{ datasetId: 1, weatherCondition: 1 }`
     - `{ datasetId: 1, dedupeKey: 1 }` (unique within each dataset scope)

---

## 6. MongoDB Atlas Setup & Environment Variables

1. Create a cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a database user with read/write privileges and allow your IP address under **Network Access**.
3. Copy `.env.example` to `.env.local` in the root folder (`e:\bda\.env.local`):

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=weatherAnalyzer
SESSION_COOKIE_NAME=weather_analyzer_session
APP_TIMEZONE=Asia/Kolkata
```

> **Note:** `.env.local` is ignored by Git via `.gitignore`. If `MONGODB_URI` is not yet configured, the application starts cleanly and displays a setup guide banner without fabricating fake data.

---

## 7. Installation & Running the Application

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 8. End-to-End Usage Guide

1. **Register & Log In:** Visit `/register` to create an account, or `/login` to sign in.
2. **Create a Workspace:** On `/workspaces`, click **New Workspace** (e.g., `"Regional Weather Study"`).
3. **Upload a Weather CSV:** Open the workspace and click **Upload Weather CSV** to select any `.csv` file with weather observations.
4. **Preview & Map Columns:** Inspect the first 20 rows and verify the normalized column mapping (`timestamp` + at least one measurement).
5. **Validate & Import:** Review the server validation report and click **Confirm & Import** to batch-insert valid observations into MongoDB.
6. **Analyze Dataset:** Use the **Analysis** tab to filter by date range, location, condition, or temperature bounds and explore the MongoDB aggregation charts.
7. **Inspect & Remediate Data Quality:** Switch to the **Data Quality** tab to view column completeness, filter flagged records by issue type, and edit or delete problematic records.

---

## 9. How MongoDB Aggregation is Used

All analytics and live quality summaries are executed inside MongoDB via `src/lib/analytics-service.ts`:
- **Summary Statistics (`/analytics/summary`):** Uses `$match` + `$facet` to compute `$avg`, `$min`, `$max`, `$sum` (ignoring `null` measurements so missing values are never treated as zero), alongside `$sort` + `$limit` facets for the hottest and coldest observations.
- **Time-Series Trends (`/analytics/temperature`, `/rainfall`, `/humidity`, `/wind`):** Uses `$match`, `$group` with `$dateToString` (respecting `APP_TIMEZONE`), `$sort`, and `$project` with `$round`.
- **Condition Frequencies (`/analytics/conditions`):** Groups by raw `weatherCondition` in MongoDB and aggregates canonical categories for reporting without overwriting raw values.
- **Live Data Quality (`/quality`):** Aggregates non-null counts, missing percentages, and out-of-plausible-range counts per column directly in MongoDB.

---

## 10. API Endpoints

| Category | Method & Route | Description |
| :--- | :--- | :--- |
| **Auth** | `POST /api/auth/register` | Register a new user account |
| | `POST /api/auth/login` | Authenticate user and set HTTP-only session cookie |
| | `POST /api/auth/logout` | Invalidate session in MongoDB and clear cookie |
| | `GET /api/auth/me` | Return current authenticated user and DB status |
| **Profile** | `GET /api/profile`, `PATCH /api/profile` | View or update username and resource counts |
| **Workspaces** | `GET /api/workspaces`, `POST /api/workspaces` | List user workspaces with dataset counts or create workspace |
| | `GET/PATCH/DELETE /api/workspaces/[workspaceId]` | View, rename/edit, or cascade-delete a workspace |
| **Datasets** | `GET/POST /api/workspaces/[workspaceId]/datasets` | List or initialize a dataset in a workspace |
| | `GET/PATCH/DELETE /api/datasets/[datasetId]` | View, rename/edit, or delete a dataset |
| **CSV Import** | `POST /api/datasets/[datasetId]/validate` | Server-side CSV parsing, mapping & data-quality validation |
| | `POST /api/datasets/[datasetId]/import` | Batched idempotent import into MongoDB |
| **Records** | `GET/POST /api/datasets/[datasetId]/records` | Paginated server search/filter/sort or add observation |
| | `PATCH/DELETE /api/datasets/[datasetId]/records/[recordId]` | Edit or delete an observation and recalculate metadata |
| **Analytics** | `GET /api/datasets/[datasetId]/analytics/summary` | Summary cards & filter options via `$facet` pipeline |
| | `GET /api/datasets/[datasetId]/analytics/temperature` | Hourly/daily/monthly temperature trends |
| | `GET /api/datasets/[datasetId]/analytics/rainfall` | Precipitation totals and peak rainfall period |
| | `GET /api/datasets/[datasetId]/analytics/humidity` | Relative humidity trends |
| | `GET /api/datasets/[datasetId]/analytics/wind` | Wind speed trends |
| | `GET /api/datasets/[datasetId]/analytics/conditions` | Normalized weather condition frequency distribution |
| | `GET /api/datasets/[datasetId]/quality` | Column completeness & flagged record inspection |

---

## 11. Testing, Linting & Production Build

```bash
# Run unit tests (Vitest)
npm test

# Run TypeScript strict typecheck
npm run typecheck

# Run ESLint
npm run lint

# Build for production
npm run build
```

---

## 12. Known Limitations & Deployment Considerations

- Maximum CSV upload size is configured at **15 MB** (up to **50,000 rows** per file) to ensure responsive serverless/route-handler execution.
- Rate limiting uses an in-memory sliding window store suitable for single-instance Node.js deployments; multi-region serverless deployments can back rate limiting with Redis if needed.
