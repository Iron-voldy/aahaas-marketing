# Aahaas Analytics - Complete Development Specification

## 1. Purpose
This document is the full implementation blueprint of the current system so a new system can be built with the same behavior and function parity.

Primary parity requirement:
- Keep all pages, API contracts, data flows, import/matching behavior, auth behavior, reporting behavior, and media/image behavior functionally equivalent.

## 2. Tech Stack
- Next.js App Router (v16)
- TypeScript
- React 19
- Tailwind + shadcn/ui
- MySQL (mysql2)
- Optional Firebase compatibility layer
- OpenAI integration for AI-assisted matching
- XLSX, jsPDF export support

## 3. High-Level Architecture
- UI pages are in app/* and mostly render dynamic client components.
- Route handlers in app/api/* provide all server-side operations.
- Data source is MySQL JSON-document style tables:
  - pkg_data (packages)
  - offer_data (seasonal offers)
  - app_logs (audit)
  - ad_campaigns (ads ingestion)
  - social_media_posts, post_package_mapping, import_sessions (report import + matching)
- Session auth uses signed cookie aahaas_session.
- Some legacy/bridge Firebase functions still exist for migration/scrape flows.

## 4. Environment Configuration
Used by current implementation:

Database:
- MYSQL_HOST / DB_HOST
- MYSQL_PORT / DB_PORT
- MYSQL_USER / DB_USERNAME
- MYSQL_PASSWORD / DB_PASSWORD
- MYSQL_DATABASE / DB_DATABASE

Session/Auth:
- SESSION_SECRET

AI matching:
- OPENAI_API_KEY

Firebase (legacy/bridge):
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID

## 5. App Routes and Page Functions

### 5.1 Core shell and routing
- / -> redirects to /dashboard
  - app/page.tsx: Home
- Root layout wraps all pages with:
  - ThemeProvider
  - AuthProvider
  - AppShell

### 5.2 Auth pages
- /login
  - app/login/page.tsx: LoginPage
  - main functions:
    - handleLogin
    - handleRegister (inline register mode inside login page)
  - behavior:
    - checks existing session via AuthProvider
    - redirects authenticated users to /dashboard
    - calls /api/auth/login and /api/auth/register
- /register
  - app/register/page.tsx: RegisterPage
  - main functions:
    - passwordStrength
    - handleRegister
  - behavior:
    - validates password and confirmation
    - calls /api/auth/register

### 5.3 Analytics and data pages
- /dashboard
  - app/dashboard/page.tsx -> DashboardClient
- /packages
  - app/packages/page.tsx -> PackagesClient
- /ads
  - app/ads/page.tsx -> AdsClient
- /offers
  - app/offers/page.tsx -> OffersClient
- /reports
  - app/reports/page.tsx -> ReportsClient
- /inquiries
  - app/inquiries/page.tsx -> InquiriesClient
- /insights
  - app/insights/page.tsx -> InsightsClient
- /data-entry
  - app/data-entry/page.tsx: DataEntryPage
  - main functions:
    - loadData
    - handleInputChange
    - handleEdit
    - handleSubmit
    - handleDelete
    - handleMigration
    - renderFields
- /logs
  - app/logs/page.tsx: AccessLogsPage
  - reads logs from /api/data/logs
- /settings
  - app/settings/page.tsx: SettingsPage
  - shows inferred schema + cloud sync form
- /scrape
  - app/scrape/page.tsx: ScrapePage
  - main functions:
    - log
    - handleScrape
  - fetches from Firebase-side functions and posts to /api/migrate/firebase-to-mysql

## 6. Navigation and Access Control
- AppShell nav items:
  - Dashboard
  - Packages
  - Ads Campaigns
  - Seasonal Offers
  - Excel Reports
  - Bookings & Inquiries
  - Insights
  - Data Entry
  - Access Logs
- AuthProvider behavior:
  - on mount calls /api/auth/me
  - unauthenticated users on protected routes are redirected to /login
  - authenticated users on /login or /register are redirected to /dashboard
  - logout calls /api/auth/logout and clears local auth state

## 7. API Surface (Complete)

### 7.1 Auth APIs
- POST /api/auth/login
  - input: { email, password }
  - action:
    - validates app_users password_hash via bcrypt
    - creates signed session token
    - sets httpOnly session cookie
    - writes app_logs entry
  - output: { user }

- POST /api/auth/register
  - input: { name, email, password }
  - action:
    - validates fields
    - blocks duplicate email
    - hashes password
    - inserts app_users
    - auto-login via session cookie
    - writes app_logs entry
  - output: { user }

- GET /api/auth/me
  - output: { user } or 401 { user: null }

- POST /api/auth/logout
  - action: expires session cookie
  - output: { ok: true }

- GET/POST /api/auth/setup-test-user
  - informational endpoint for Firebase test user setup instructions

### 7.2 Packages APIs
- GET /api/data/packages
  - reads pkg_data JSON rows + history
  - output: Row[]

- POST /api/data/packages
  - input: { data, entryDate? }
  - action:
    - stores JSON in pkg_data
    - optionally creates date-keyed numeric metric snapshot in history
  - output: { id }

- GET /api/data/packages/:id
  - output: single package row + history

- PUT /api/data/packages/:id
  - input: { data, entryDate? }
  - action:
    - merges incoming data over existing JSON
    - updates updatedAt
    - merges numeric metrics into history[entryDate]
  - output: { ok: true }

- DELETE /api/data/packages/:id
  - action:
    - detaches report mappings
    - if needed re-categorizes associated social posts to general
    - deletes package row
  - output: { ok: true }

### 7.3 Offers APIs
- GET /api/data/offers
  - reads offer_data rows
  - sorts by datePublished desc
  - output: SeasonalOffer[]

- POST /api/data/offers
  - input: { data }
  - action: inserts JSON row with updatedAt
  - output: { id }

- PUT /api/data/offers/:id
  - input: { data }
  - action:
    - merges into existing JSON
    - removes empty/undefined/NaN fields
    - updates updatedAt
  - output: { ok: true }

- DELETE /api/data/offers/:id
  - action:
    - detaches report mappings
    - re-categorizes related posts to general when needed
    - deletes offer row
  - output: { ok: true }

### 7.4 Logs API
- GET /api/data/logs
  - returns latest 500 app_logs rows
- POST /api/data/logs
  - input: { email, action }
  - inserts app_logs record

### 7.5 Ads APIs
- GET /api/ads
  - ensures ad_campaigns table
  - returns normalized ad rows sorted by amount_spent_usd desc

- DELETE /api/ads
  - clears ad_campaigns table

- PUT /api/ads/:id
  - input: { booking_count?, product_image_url?, product_image_urls? }
  - updates booking and image fields
  - returns normalized updated row

- DELETE /api/ads/:id
  - deletes one ad row

- POST /api/ads/upload
  - input: multipart/form-data with file
  - supports Excel upload
  - maps spreadsheet headers to DB columns
  - parses Excel serial dates
  - inserts ad_campaigns rows with batch_id
  - output: { ok, inserted, batchId }

- POST /api/ads/categorize
  - input: { adId, category: package | seasonal_offer }
  - action:
    - loads ad row
    - transforms ad metrics to package or offer JSON shape
    - upserts into pkg_data or offer_data by source=ads_campaign and sourceAdId
  - output: { ok, id, mode, category }

- POST /api/ads/migrate
  - ensures ads table exists

### 7.6 Reports import + categorization APIs
- POST /api/import-sheets
  - input: { files, packages, offers }
  - flow:
    - combines FB/IG posts/videos/stories
    - runs deterministic processImport matching
    - optionally runs AI matching for unmatched posts
    - enforces date and country guardrails for AI package matches
    - writes import_sessions
    - upserts social_media_posts (dedupe by source_type + post_id)
    - refreshes post_package_mapping for matched items
  - output:
    - sessionId
    - packageUpdates
    - offerUpdates
    - unmatchedPosts
    - stats

- GET /api/reports/posts
  - query params: from, to, source, category
  - returns deduplicated latest post records with optional filters
  - joins mapping + package image
  - returns summary aggregate block

- POST /api/reports/categorize
  - input: { postIds, category: package|seasonal_offer|ignore, postData? }
  - flow:
    - removes old mappings
    - updates category/ignore flag
    - for package/seasonal_offer:
      - inserts new target JSON row
      - creates manual mapping confidence=100
  - output: { success, updated, category, insertedId }

### 7.7 Sync, migrate, export APIs
- POST /api/packages/sync
  - input: { url }
  - fetches SharePoint/OneDrive or direct file URL
  - parses excel or CSV
  - validates content
  - writes public/data/packages.csv when writable
  - returns parsed rows for client caching

- POST /api/migrate
  - migrates local CSV rows into pkg_data

- POST /api/migrate/firebase-to-mysql
  - input: { packages, offers }
  - clears and reinserts pkg_data + offer_data from Firebase payload

- GET /api/export-db
  - exports packages, offers, and logs from MySQL

- GET /api/csv
  - returns rows from loadCsv

## 8. Complete Media and Photo Upload Functionality

### 8.1 Ads image flow (full upload workflow)
Primary file: components/ads/AdsClient.tsx

Functions involved:
- fileToDataUrl
- handleImageUpload
- handleRemoveImage
- handleSave
- handleSaveAd
- normalizeImageUrls

Behavior:
1. User opens ad details and selects local image files.
2. handleImageUpload converts each selected file to data URL (base64) via FileReader.
3. Local preview list imageUrls is updated in component state.
4. User can remove images before save (handleRemoveImage).
5. On save:
   - first image becomes product_image_url
   - full array saved in product_image_urls
6. Client calls PUT /api/ads/:id with booking_count and image fields.
7. API normalizes and persists both primary and list URLs.
8. ad row normalization ensures backward compatibility if only one image exists.

Important parity rule:
- Keep both single image field and array field in new system.
  - primary: product_image_url
  - gallery: product_image_urls

### 8.2 Offers image flow
Primary file: components/offers/OffersClient.tsx

Behavior:
- supports multi image URL inputs in form
- first URL stored as imageUrl
- full list stored as imageUrls
- create/update via /api/data/offers and /api/data/offers/:id

Important parity rule:
- Preserve dual storage of first image and full array.

### 8.3 Packages image flow
Locations:
- app/data-entry/page.tsx
- components/table/PackagesClient.tsx

Behavior:
- Data Entry page currently accepts image URL text input (not file picker)
- stored as imageUrl in package JSON
- package lists use imageUrls[0] fallback to imageUrl when rendering

Important parity rule:
- Support both imageUrl and imageUrls for package display compatibility.

### 8.4 Reports and inquiries image rendering
- ReportsClient reads package_image_url from joined query, uses NextImage with bypass checks for known CDNs.
- InquiriesClient derives image URL from multiple possible fields and displays preview cards.

### 8.5 Image utility behavior
lib/image.ts:
- isRemoteImageUrl
- shouldBypassNextImageOptimization
- isVideoUrl
- getFacebookEmbedUrl
- getInstagramEmbedUrl

Parity rule:
- maintain optimization bypass logic for Firebase/Facebook/Instagram CDN hosts to avoid broken thumbnails.

## 9. Data Models and Persistence

### 9.1 Primary app tables
- app_users
- app_logs
- pkg_data (JSON data + history JSON)
- offer_data (JSON data)

### 9.2 Ads table
- ad_campaigns
- includes ad metrics, booking_count, product_image_url, product_image_urls

### 9.3 Reports/matching tables
- import_sessions
- social_media_posts
- post_package_mapping

## 10. Core Libraries and Function Responsibilities

### 10.1 Data access and adapters
- lib/db.ts
  - client-side API wrapper for packages/offers/logs CRUD
- lib/mysql.ts
  - singleton connection pool resolver
- lib/session.ts
  - signed cookie token create/verify and user extraction

### 10.2 Ads helpers
- lib/ads.ts
  - ensureAdsTable
  - normalizeAdCampaign
  - image JSON/string normalization

### 10.3 Import/matching helpers
- lib/postIdentifier.ts
  - parsing, hashtag/country/category detection, matching, aggregation
- lib/openai.ts
  - AI match batch calls with strict prompt guards
- lib/reportMappings.ts
  - mapping removal/creation and post category updates

### 10.4 Analytics and schema
- lib/loadCsv.ts
  - CSV parser with multi-row header handling
- lib/inferSchema.ts
  - infer numeric/date/categorical/high-cardinality columns
- lib/aggregate.ts
  - KPI, trend, top-N, outlier, insights computations

### 10.5 Content/source and image helpers
- lib/contentSource.ts
  - normalize source as post vs ads_campaign
- lib/image.ts
  - URL/media detection and embed URL generation

### 10.6 Client hooks
- hooks/useFilters.ts
  - centralized dashboard filtering reducer
- hooks/useCloudCache.ts
  - cloud data cache logic

## 11. Page-to-Component Functional Map
- Dashboard -> DashboardClient + Filters + KpiCards + charts
- Packages -> PackagesClient + PackagesTable + package modals + bulk import/upload
- Ads -> AdsClient + AdDetailModal + upload/categorize/export actions
- Offers -> OffersClient + OfferCard + OfferDetailModal
- Reports -> ReportsClient with grouping, filters, export, detail modal
- Inquiries -> InquiriesClient with update modal and merged package/offer inquiry tracking
- Insights -> InsightsClient
- Data Entry -> manual package CRUD + image URL + boost fields + migrate CSV
- Logs -> access log table view
- Settings -> SyncForm + schema diagnostics

## 12. Complete Function Index (Current Codebase)
This is the implementation index used for parity verification.

### 12.1 App-level functions
- AdsPage
- DashboardPage
- DataEntryPage
- loadData
- handleInputChange
- handleEdit
- handleSubmit
- handleDelete
- handleMigration
- renderFields
- InquiriesPage
- InsightsPage
- LoginPage
- handleLogin
- handleRegister
- AccessLogsPage
- OffersPage
- PackagesPage
- RegisterPage
- passwordStrength
- ReportsPage
- ScrapeLayout
- ScrapePage
- log
- handleScrape
- SettingsPage
- RootLayout
- Home

### 12.2 API route functions
- buildPackageData
- buildOfferData
- upsertTarget
- toSqlDate
- parseOfferRows
- sortOffersByPublishedDate
- parsePackageRows
- toMysqlDatetime
- toInt
- toDec
- summarizePost
- reAggregate
- reAggregateOffers
- GET/POST/PUT/DELETE handlers under all endpoints listed in section 7

### 12.3 Major component functions
- AdsClient.tsx:
  - fmt
  - fmtUsd
  - fmtPct
  - shortName
  - deliveryBadge
  - resultLabel
  - titleize
  - objectiveLabel
  - viewsValue
  - engagementsValue
  - parseAdDate
  - formatAdDateTimeSL
  - dateRangeSummary
  - normalizeImageUrls
  - normalizeAdCampaign
  - fileToDataUrl
  - exportAdToXlsx
  - exportAllToXlsx
  - KpiCard
  - ChartCard
  - AdDetailModal
  - handleImageUpload
  - handleRemoveImage
  - handleCancelEdit
  - handleSave
  - AdsClient
  - load
  - handleUpload
  - handleClearAll
  - handleDeleteAd
  - handleSaveAd
  - handleAddToCategory
  - toggleSort
  - AdCard

- OffersClient.tsx:
  - OffersClient
  - loadOffers
  - handleInput
  - resetForm
  - handleEdit
  - handleDelete
  - handleSubmit

- PackagesClient.tsx:
  - PackagesClient
  - toggleSelect
  - clearSelection
  - removeFromComparison
  - handleDeletePackage
  - resetAllFilters

- ReportsClient.tsx:
  - fmt
  - extractPrice
  - fmtDate
  - getEmbeddablePostUrl
  - toEmbedUrl
  - getMonthOptions
  - aggregateMonthStats
  - getDestTheme
  - normalizeForGrouping
  - isSameDay
  - computeWordOverlap
  - groupPosts
  - ReportsClient
  - handleSort
  - setPresetRange
  - handleExport
  - PostCard
  - handleExportPostXlsx
  - MetricPill
  - PostDetailModal
  - FilterChip
  - SortBtn

- InquiriesClient.tsx:
  - UpdateModal
  - handleInput
  - handleSave
  - InquiriesClient
  - loadData

- Auth/layout/settings:
  - AuthProvider
  - logout
  - useAuth
  - NavLink
  - Sidebar
  - AppShell
  - ThemeProvider
  - ThemeToggle
  - SyncForm
  - handleSync

- Chart and UI component functions are preserved as in code and should be retained for rendering parity.

### 12.4 Core library functions
- lib/firebase/admin.ts: initAdmin, getAdminDb
- lib/firebase/db.ts: ensureFirebaseAuth, getPackages, parseSafeDate, getPackage, addPackage, updatePackage, deletePackage, getOffers, addOffer, updateOffer, deleteOffer, logAccess, getLogs
- lib/ads.ts: ensureAdsTable, normalizeImageUrls, normalizeAdCampaign
- lib/aggregate.ts: groupBy, getDeltaForRange, sumColumn, avgColumn, dateBucket, timeSeries, timeSeriesByCategory, topN, pieBreakdown, detectOutliers, computeKpis, findCol, generateInsights, getLatestUpdateDate
- lib/contentSource.ts: normalizeContentSource, getPackageSource, getOfferSource, matchesContentSource, getContentSourceLabel
- lib/csvImport.ts: safeNum, detectFileType, extractMetrics, parseCsvPublishTime, parseFirestoreDate, sameMinute, sameDay, matchToPackage, aggregateByPackage, parseCsvFile, parseAllFiles
- lib/db.ts: getPackages, getPackage, addPackage, updatePackage, deletePackage, getOffers, addOffer, updateOffer, deleteOffer, logAccess, getLogs
- lib/exporters.ts: normalizeValue, sanitizeFileName, toRecordRows, exportRecordToXlsx, exportRecordToPdf
- lib/image.ts: isRemoteImageUrl, shouldBypassNextImageOptimization, isVideoUrl, getFacebookEmbedUrl, getInstagramEmbedUrl
- lib/inferSchema.ts: isDateString, isNumericColumn, isDateColumn, isCategoricalColumn, inferSchema, parseFlexibleDate
- lib/loadCsv.ts: splitCsvLine, parseCell, propagate, buildColumnName, parseCsv, getSampleData, loadCsv
- lib/mysql.ts: getMysqlPool
- lib/openai.ts: matchPostsWithAI, callOpenAI
- lib/postIdentifier.ts: parsePublishTime, parsePackageDate, sameDay, withinDays, extractHashtags, detectCountry, identifyCategory, countryMatches, normalizeDuration, nameMatchScore, normalize, findPackageMatch, findOfferMatch, processImport, aggregatePackageUpdates, aggregateOfferUpdates
- lib/publishedDate.ts: getPublishedDateColumn, getPublishedDate, sortRowsByPublishedDate
- lib/reportMappings.ts: hasIgnoredColumn, ensureIgnoredColumn, removeMappingsForPosts, updatePostsCategory, createManualMappings, detachTargetMappings
- lib/session.ts: hmac, createSessionToken, verifySessionToken, getSessionUser
- lib/utils.ts: cn
- hooks/useCloudCache.ts: useCloudCache
- hooks/useFilters.ts: reducer, useFilters

## 13. Functional Equivalence Checklist for New System
To ensure both systems behave the same:

1. Keep identical API endpoints and payload shapes.
2. Keep JSON document structures for package/offer data compatible with existing fields.
3. Preserve history snapshot merge behavior for packages by entryDate.
4. Keep ads upload parsing header map and date conversion behavior.
5. Keep ads image model dual fields (product_image_url + product_image_urls).
6. Keep offers image model dual fields (imageUrl + imageUrls).
7. Keep package image fallback logic (imageUrls[0] or imageUrl).
8. Keep reports dedupe logic by source_type + post_id, latest imported_at.
9. Keep mapping lifecycle:
   - recategorize/detach on delete
   - manual mapping on report categorization
10. Keep OpenAI matching guardrails:
    - confidence threshold
    - date window controls
    - country mismatch rejection
11. Keep auth cookie contract and redirect flow exactly.
12. Keep SyncForm cloud caching behavior in browser localStorage.
13. Keep exports (xlsx/pdf/json) where currently used.

## 14. Recommended Migration Strategy for New Build
1. Replicate DB schema and route contracts first.
2. Port auth/session middleware and protected-route behavior.
3. Port packages/offers CRUD + image field compatibility.
4. Port ads module with upload, normalize, categorize.
5. Port import-sheets + report views + categorization.
6. Port UI pages/components in same navigation order.
7. Validate parity using endpoint-by-endpoint response snapshots.

## 15. Validation Test Matrix (Must Pass)
- Auth:
  - register, login, me, logout, cookie persistence
- Package CRUD:
  - create, update with entryDate history, delete mapping cleanup
- Offer CRUD:
  - create/update/delete + mapping cleanup
- Ads:
  - excel upload insert count
  - per-ad image upload/save
  - categorize to package and offer
- Reports:
  - import 4 CSV types
  - matching stats and unmatched output
  - manual categorize to package/offer/ignore
  - summary aggregate values
- Media:
  - package, offer, ad image rendering fallback
  - external CDN image display
- Sync:
  - SharePoint/OneDrive URL fetch + local cache behavior

---
This file is the canonical parity document for rebuilding the same system behavior with full function coverage and complete image/photo handling details.
