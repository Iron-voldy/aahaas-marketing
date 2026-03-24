"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Info,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import type { Row } from "@/lib/types";
import {
  parseCsvFile,
  aggregateByPackage,
  FILE_TYPE_LABELS,
  FILE_TYPE_COLORS,
  type ParsedRow,
  type PackageStats,
  type CsvFileType,
} from "@/lib/csvImport";
import { updatePackage } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "upload" | "review" | "applying" | "done";
type ReviewTab = "matched" | "unmatched";

interface UploadedFile {
  file: File;
  fileType: CsvFileType;
  rowCount: number;
  parsed: boolean;
}

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  packages: Row[];
  onUpdateSuccess: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPackageDisplayName(pkg: Row | undefined): string {
  if (!pkg) return "Unknown";
  const country = String(pkg["Country"] || pkg["country"] || "").trim();
  const type = String(pkg["Package"] || pkg["package"] || "").trim();
  const rawDate = String(pkg["Date Published"] || pkg["date_published"] || "").trim();
  // Shorten date to just the day-month part
  const datePart = rawDate.split(",")[0] || rawDate;
  return [country || type, datePart].filter(Boolean).join(" · ");
}

function MetricPill({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  if (value === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
        highlight
          ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
          : "bg-slate-100 dark:bg-white/8 text-slate-600 dark:text-slate-400"
      )}
    >
      {label}: {value.toLocaleString()}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BulkUploadModal({
  open,
  onClose,
  packages,
  onUpdateSuccess,
}: BulkUploadModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("matched");

  // Upload step
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Review step
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  // Apply step
  const [applyLog, setApplyLog] = useState<{ name: string; ok: boolean }[]>([]);
  const [applyProgress, setApplyProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Reset on close ──────────────────────────────────────────────────────────
  function handleClose() {
    setStep("upload");
    setUploadedFiles([]);
    setParsedRows([]);
    setApplyLog([]);
    setApplyProgress(0);
    setReviewTab("matched");
    onClose();
  }

  // ── File handling ───────────────────────────────────────────────────────────
  async function addFiles(newFiles: FileList | File[]) {
    const csvFiles = Array.from(newFiles).filter(
      (f) => f.name.endsWith(".csv") || f.name.endsWith(".txt")
    );
    if (!csvFiles.length) return;

    const entries: UploadedFile[] = csvFiles.map((f) => ({
      file: f,
      fileType: "unknown",
      rowCount: 0,
      parsed: false,
    }));
    setUploadedFiles((prev) => [...prev, ...entries]);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  function removeFile(idx: number) {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Parse files & build review state ───────────────────────────────────────
  async function handleParse() {
    if (!uploadedFiles.length) return;
    setIsParsing(true);
    try {
      const allRows: ParsedRow[] = [];
      const updatedFiles: UploadedFile[] = [];

      for (const entry of uploadedFiles) {
        const rows = await parseCsvFile(entry.file, packages);
        allRows.push(...rows);
        updatedFiles.push({
          ...entry,
          fileType: rows[0]?.fileType ?? "unknown",
          rowCount: rows.length,
          parsed: true,
        });
      }

      setUploadedFiles(updatedFiles);
      setParsedRows(allRows);
      setStep("review");
    } catch (err) {
      console.error("Parse error:", err);
      alert("Failed to parse one or more files. Please check the format.");
    } finally {
      setIsParsing(false);
    }
  }

  // ── Update package assignment for an unmatched row ──────────────────────────
  function assignPackage(uid: string, packageId: string) {
    setParsedRows((prev) =>
      prev.map((r) =>
        r.uid === uid
          ? { ...r, assignedPackageId: packageId || null, matchScore: packageId ? 1 : 0 }
          : r
      )
    );
  }

  // ── Apply updates to Firestore ───────────────────────────────────────────────
  async function handleApply() {
    setStep("applying");
    const agg = aggregateByPackage(parsedRows);
    const entries = Array.from(agg.entries());
    const log: { name: string; ok: boolean }[] = [];

    for (let i = 0; i < entries.length; i++) {
      const [pkgId, stats] = entries[i];
      const pkg = packages.find((p) => p.id === pkgId);
      const name = getPackageDisplayName(pkg);

      try {
        await updatePackage(pkgId, stats as Partial<Row>);
        log.push({ name, ok: true });
      } catch (err) {
        console.error(`Failed to update ${name}:`, err);
        log.push({ name, ok: false });
      }

      setApplyProgress(Math.round(((i + 1) / entries.length) * 100));
    }

    setApplyLog(log);
    setStep("done");
    onUpdateSuccess();
  }

  // ── Derived data for review step ────────────────────────────────────────────
  const matchedRows = parsedRows.filter((r) => r.assignedPackageId);
  const unmatchedRows = parsedRows.filter((r) => !r.assignedPackageId);
  const aggMap = aggregateByPackage(parsedRows);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col bg-white dark:bg-[#0a0a0f] border-slate-200 dark:border-white/10 p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-white/5 shrink-0">
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
            {step === "upload" && "Bulk Upload — Insights Files"}
            {step === "review" && "Review & Assign Packages"}
            {step === "applying" && "Applying Updates…"}
            {step === "done" && "Updates Complete"}
          </DialogTitle>

          {/* Step indicator */}
          {(step === "upload" || step === "review") && (
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
              <span className={cn("font-semibold", step === "upload" ? "text-violet-600 dark:text-violet-400" : "text-slate-400")}>
                1 · Upload
              </span>
              <ChevronRight className="w-3 h-3" />
              <span className={cn("font-semibold", step === "review" ? "text-violet-600 dark:text-violet-400" : "text-slate-400")}>
                2 · Review
              </span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-400 font-semibold">3 · Apply</span>
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
          {step === "upload" && (
            <div className="p-6 space-y-5">
              {/* Info banner */}
              <div className="flex gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                  Upload your Facebook & Instagram Insights exports (CSV format). The system
                  auto-detects the file type and matches each post to a package by publish date/time.
                  Supported: <strong>FB Posts</strong>, <strong>FB Videos</strong>,{" "}
                  <strong>IG Posts / Reels</strong>, <strong>IG Stories</strong>.
                </p>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors",
                  isDragging
                    ? "border-violet-400 bg-violet-50 dark:bg-violet-500/10"
                    : "border-slate-200 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500/40 hover:bg-violet-50/50 dark:hover:bg-violet-500/5"
                )}
              >
                <UploadCloud className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Drop CSV files here
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    or click to browse — you can select multiple files
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  multiple
                  className="sr-only"
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                />
              </div>

              {/* File list */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Selected files
                  </p>
                  {uploadedFiles.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/8"
                    >
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">
                        {entry.file.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {(entry.file.size / 1024).toFixed(1)} KB
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Review ─────────────────────────────────────────────── */}
          {step === "review" && (
            <div className="flex flex-col h-full">
              {/* Summary bar */}
              <div className="px-6 py-3 border-b border-slate-100 dark:border-white/5 flex flex-wrap gap-2 shrink-0">
                {uploadedFiles.map((f, i) => (
                  <span
                    key={i}
                    className={cn(
                      "text-[11px] font-semibold px-2.5 py-1 rounded-full",
                      FILE_TYPE_COLORS[f.fileType]
                    )}
                  >
                    {FILE_TYPE_LABELS[f.fileType]} · {f.rowCount} posts
                  </span>
                ))}
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 ml-auto">
                  {aggMap.size} packages to update
                </span>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 dark:border-white/5 shrink-0">
                {(["matched", "unmatched"] as ReviewTab[]).map((tab) => {
                  const count = tab === "matched" ? matchedRows.length : unmatchedRows.length;
                  return (
                    <button
                      key={tab}
                      onClick={() => setReviewTab(tab)}
                      className={cn(
                        "flex items-center gap-1.5 px-5 py-3 text-xs font-semibold border-b-2 transition-colors",
                        reviewTab === tab
                          ? "border-violet-600 text-violet-600 dark:text-violet-400"
                          : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      )}
                    >
                      {tab === "matched" ? "Auto-matched" : "Unmatched"}
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                          tab === "matched"
                            ? "bg-emerald-500/15 text-emerald-600"
                            : unmatchedRows.length > 0
                            ? "bg-amber-500/15 text-amber-600"
                            : "bg-slate-100 dark:bg-white/8 text-slate-500"
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">

                {/* ── Matched tab: show aggregated-per-package preview ── */}
                {reviewTab === "matched" && (
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {aggMap.size === 0 ? (
                      <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
                        <AlertCircle className="w-8 h-8 opacity-40" />
                        <p className="text-sm">No posts were auto-matched to packages.</p>
                        <p className="text-xs text-slate-500">
                          Go to &quot;Unmatched&quot; to manually assign posts.
                        </p>
                      </div>
                    ) : (
                      Array.from(aggMap.entries()).map(([pkgId, stats]) => {
                        const pkg = packages.find((p) => p.id === pkgId);
                        const rows = matchedRows.filter((r) => r.assignedPackageId === pkgId);
                        return (
                          <PackageUpdateRow
                            key={pkgId}
                            pkgName={getPackageDisplayName(pkg)}
                            stats={stats}
                            postCount={rows.length}
                            postTypes={[...new Set(rows.map((r) => r.fileType))]}
                          />
                        );
                      })
                    )}
                  </div>
                )}

                {/* ── Unmatched tab: assign manually ── */}
                {reviewTab === "unmatched" && (
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {unmatchedRows.length === 0 ? (
                      <div className="flex flex-col items-center py-16 gap-3 text-emerald-500">
                        <CheckCircle2 className="w-8 h-8" />
                        <p className="text-sm font-medium">All posts were matched!</p>
                      </div>
                    ) : (
                      unmatchedRows.map((row) => (
                        <UnmatchedRow
                          key={row.uid}
                          row={row}
                          packages={packages}
                          onAssign={(pkgId) => assignPackage(row.uid, pkgId)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step: Applying ─────────────────────────────────────────────── */}
          {step === "applying" && (
            <div className="p-8 flex flex-col items-center justify-center gap-5">
              <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Updating packages…
                </p>
                <p className="text-xs text-slate-500 mt-1">{applyProgress}% complete</p>
              </div>
              {/* Progress bar */}
              <div className="w-full max-w-xs h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-300 rounded-full"
                  style={{ width: `${applyProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Step: Done ─────────────────────────────────────────────────── */}
          {step === "done" && (
            <div className="p-6 space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {applyLog.filter((l) => l.ok).length} packages updated successfully
                  </p>
                  {applyLog.filter((l) => !l.ok).length > 0 && (
                    <p className="text-xs text-red-500 mt-0.5">
                      {applyLog.filter((l) => !l.ok).length} updates failed — see console for details
                    </p>
                  )}
                </div>
              </div>

              {/* Package list */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {applyLog.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/4"
                  >
                    {entry.ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                      {entry.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center shrink-0">
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={handleClose} className="text-sm">
                Cancel
              </Button>
              <Button
                onClick={handleParse}
                disabled={uploadedFiles.length === 0 || isParsing}
                className="bg-violet-600 hover:bg-violet-700 text-white gap-2 text-sm"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Parsing…
                  </>
                ) : (
                  <>
                    Parse Files <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </>
          )}

          {step === "review" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("upload")}
                className="text-sm"
              >
                ← Back
              </Button>

              <div className="flex items-center gap-3">
                {aggMap.size === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Assign at least one post to apply updates.
                  </p>
                )}
                <Button
                  onClick={handleApply}
                  disabled={aggMap.size === 0}
                  className="bg-violet-600 hover:bg-violet-700 text-white gap-2 text-sm"
                >
                  Apply {aggMap.size} Updates →
                </Button>
              </div>
            </>
          )}

          {step === "done" && (
            <Button
              onClick={handleClose}
              className="ml-auto bg-violet-600 hover:bg-violet-700 text-white text-sm"
            >
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Row for the matched-packages summary table */
function PackageUpdateRow({
  pkgName,
  stats,
  postCount,
  postTypes,
}: {
  pkgName: string;
  stats: PackageStats;
  postCount: number;
  postTypes: CsvFileType[];
}) {
  return (
    <div className="px-6 py-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-white flex-1 truncate">
          {pkgName}
        </span>
        <span className="text-[10px] text-slate-400">
          {postCount} post{postCount !== 1 ? "s" : ""}
        </span>
        {postTypes.map((t) => (
          <span
            key={t}
            className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
              FILE_TYPE_COLORS[t]
            )}
          >
            {FILE_TYPE_LABELS[t]}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <MetricPill label="FB Reach" value={stats["FB Reach"]} highlight />
        <MetricPill label="FB React." value={stats["FB Interactions (Reactions)"]} />
        <MetricPill label="FB Clicks" value={stats["FB Total Clicks"]} />
        <MetricPill label="IG Reach" value={stats["IG Reach"]} highlight />
        <MetricPill label="IG React." value={stats["IG Interactions (Reactions)"]} />
        <MetricPill label="IG Saves" value={stats["IG Interactions (Saves)"]} />
        <MetricPill label="Combined" value={stats["Combined Reach"]} highlight />
      </div>
    </div>
  );
}

/** Row for the unmatched posts, with a package selector */
function UnmatchedRow({
  row,
  packages,
  onAssign,
}: {
  row: ParsedRow;
  packages: Row[];
  onAssign: (pkgId: string) => void;
}) {
  const { fbReach, fbReactions, fbTotalClicks, igReach, igReactions, igSaves } =
    row.metrics;

  return (
    <div className="px-6 py-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
            FILE_TYPE_COLORS[row.fileType]
          )}
        >
          {FILE_TYPE_LABELS[row.fileType]}
        </span>
        <span className="text-xs text-slate-500 shrink-0">{row.publishTime}</span>
        <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1 italic line-clamp-1">
          {row.postTitle || "No title"}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Metrics preview */}
        <div className="flex flex-wrap gap-1">
          <MetricPill label="FB Reach" value={fbReach} />
          <MetricPill label="FB React." value={fbReactions} />
          <MetricPill label="FB Clicks" value={fbTotalClicks} />
          <MetricPill label="IG Reach" value={igReach} />
          <MetricPill label="IG React." value={igReactions} />
          <MetricPill label="IG Saves" value={igSaves} />
        </div>

        {/* Package selector */}
        <select
          className="ml-auto text-xs h-7 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 px-2 focus:ring-1 focus:ring-violet-500 outline-none min-w-45"
          value={row.assignedPackageId ?? ""}
          onChange={(e) => onAssign(e.target.value)}
          suppressHydrationWarning
        >
          <option value="">— Skip this post —</option>
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id ?? ""}>
              {getPackageDisplayName(pkg)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
