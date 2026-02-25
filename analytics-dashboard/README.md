# Aahaas Analytics Dashboard

A production-ready interactive analytics web app for Aahaas travel & marketing, built with **Next.js 15**, **TypeScript**, **TailwindCSS**, **shadcn/ui**, **Recharts**, and **TanStack Table**.

## 🚀 Quick Start (Local Dev)

```bash
cd analytics-dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → auto-redirects to `/dashboard`.

## 📁 CSV Data File

The app reads from: `public/data/packages.csv`

To update the data: **replace** this file with a new CSV export. No code changes needed — the app auto-detects column types on every request.

> **Source format**: The CSV uses a 3-row header structure (section → sub-section → column name). The parser merges these into compound names like `fb_reactions`, `ig_reach`, `ads_spend_`.

## 🌐 Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Or connect the `analytics-dashboard/` folder to a Vercel project via the Vercel dashboard. No extra environment variables or build configuration required.

> **CSV on Vercel**: The `public/data/packages.csv` is bundled at deploy time. To update data, replace the file and redeploy.

## 📂 Directory Structure

```
analytics-dashboard/
├── app/
│   ├── layout.tsx             # Root layout (ThemeProvider + AppShell)
│   ├── page.tsx               # Redirect → /dashboard
│   ├── dashboard/page.tsx     # Main analytics page (server component)
│   ├── packages/page.tsx      # Data table page
│   ├── insights/page.tsx      # Auto-generated insights page
│   └── settings/page.tsx      # Settings + schema info
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx       # Sidebar + header + mobile drawer
│   │   ├── ThemeToggle.tsx    # Light/dark toggle button
│   │   └── ThemeProvider.tsx  # next-themes wrapper
│   ├── dashboard/
│   │   ├── DashboardClient.tsx
│   │   ├── KpiCards.tsx       # Dynamic KPI stat cards
│   │   ├── Filters.tsx        # Global filter panel
│   │   └── Charts/
│   │       ├── TrendChart.tsx    # Line chart by date
│   │       ├── TopBarChart.tsx   # Top-N bar chart
│   │       ├── DonutChart.tsx    # Pie/donut breakdown
│   │       └── CompareChart.tsx  # Multi-series comparison
│   └── table/
│       ├── PackagesTable.tsx  # TanStack Table (sort/filter/paginate/export)
│       └── PackagesClient.tsx
├── hooks/
│   └── useFilters.ts          # Global filter state (useReducer)
├── lib/
│   ├── types.ts               # TypeScript interfaces
│   ├── loadCsv.ts             # Server-side CSV parser
│   ├── inferSchema.ts         # Auto column-type detection
│   └── aggregate.ts           # groupBy, timeSeries, topN, outliers, KPIs
└── public/
    └── data/
        └── packages.csv       # 👈 Replace this file to update data
```

## 🧠 Auto Column Detection Logic

`lib/inferSchema.ts` runs an inference step on raw CSV rows:

| Type | Detection Rule |
|---|---|
| **Date** | Column name matches `date\|time\|created\|published\|booked\|start\|end` AND/OR ≥60% of values parse as date strings |
| **Numeric** | ≥70% of non-empty values parse as finite numbers |
| **Categorical** | String type with ≤30 unique values (used for filter dropdowns & charts) |
| **High-cardinality** | Strings with >30 unique values (excluded from filters by default) |

All charts and KPI cards are driven by the inferred schema — no column names are hardcoded in the UI layer.

## 📊 Features

- **4 chart types**: Trend line, top-N bar, donut/pie, multi-series compare
- **Global filters**: Date range, category multi-select, full-text search
- **KPI cards**: Auto-computed from numeric columns (reach, spend, conversations, etc.)
- **Data table**: TanStack Table with sort, pagination, column visibility, CSV export
- **Insights page**: Deterministic analysis — top performer, growth rate, IQR outliers
- **Dark/light mode** with system preference support
- **Mobile-first**: Collapsible sidebar drawer on small screens

## 🛠 Tech Stack

| Package | Version | Purpose |
|---|---|---|
| Next.js | 15+ | App Router, server components |
| TypeScript | 5+ | Type safety |
| TailwindCSS | 4 | Styling |
| shadcn/ui | latest | UI components |
| Recharts | latest | Charts |
| @tanstack/react-table | v8 | Data grid |
| next-themes | latest | Theme management |
| date-fns | latest | Date parsing helpers |
