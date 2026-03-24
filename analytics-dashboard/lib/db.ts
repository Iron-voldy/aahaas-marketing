/**
 * lib/db.ts
 *
 * Drop-in replacement for lib/firebase/db.ts  — uses MySQL via Next.js API routes.
 * Client components import from here; API routes use lib/mysql.ts directly.
 *
 * Exports the same interface as the old firebase/db.ts so no component
 * code changes are needed beyond updating the import path.
 */

import type { Row } from "@/lib/types";

// Re-export the types so imports from "@/lib/db" work the same as "@/lib/firebase/db"
export interface AuditLog {
    id?: string;
    email: string;
    action: string;
    timestamp: string;
}

export interface SeasonalOffer {
    id?: string;
    name: string;
    category: string;
    postType?: "single" | "group";
    description?: string;
    validityPeriod?: string;
    price?: string;
    originalPrice?: string;
    datePublished?: string;
    postUrl?: string;           // permalink to the social media post
    imageUrl?: string;
    imageUrls?: string[];
    isBoosted?: boolean;
    // Social stats
    fbReach?: number;
    fbReactions?: number;
    fbComments?: number;
    fbShares?: number;
    fbClicks?: number;
    igReach?: number;
    igReactions?: number;
    igComments?: number;
    igShares?: number;
    igSaves?: number;
    combinedReach?: number;
    // Boost fields
    adSpend?: number;
    impressions?: number;
    conversations?: number;
    // Inquiries and Bookings
    inquiries?: number;
    inquiriesFb?: number;
    inquiriesIg?: number;
    inquiriesWa?: number;
    inquiriesWeb?: number;
    inquiriesOther?: number;
    bookings?: number;
    [key: string]: string | number | boolean | string[] | undefined;
}

// ─── Internal fetch helper ──────────────────────────────────────────────────

async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
    const resp = await fetch(url, {
        ...options,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    });
    if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error((body as { error?: string }).error ?? `HTTP ${resp.status}`);
    }
    return resp.json() as Promise<T>;
}

// ─── Packages ───────────────────────────────────────────────────────────────

export async function getPackages(): Promise<Row[]> {
    return apiFetch<Row[]>("/api/data/packages");
}

export async function getPackage(id: string): Promise<Row | null> {
    return apiFetch<Row | null>(`/api/data/packages/${id}`);
}

export async function addPackage(data: Omit<Row, "id">, entryDate?: string): Promise<string> {
    const result = await apiFetch<{ id: string }>("/api/data/packages", {
        method: "POST",
        body: JSON.stringify({ data, entryDate }),
    });
    return result.id;
}

export async function updatePackage(id: string, data: Partial<Row>, entryDate?: string): Promise<void> {
    await apiFetch(`/api/data/packages/${id}`, {
        method: "PUT",
        body: JSON.stringify({ data, entryDate }),
    });
}

export async function deletePackage(id: string): Promise<void> {
    await apiFetch(`/api/data/packages/${id}`, { method: "DELETE" });
}

// ─── Seasonal Offers ────────────────────────────────────────────────────────

export async function getOffers(): Promise<SeasonalOffer[]> {
    return apiFetch<SeasonalOffer[]>("/api/data/offers");
}

export async function addOffer(data: Omit<SeasonalOffer, "id">): Promise<string> {
    const result = await apiFetch<{ id: string }>("/api/data/offers", {
        method: "POST",
        body: JSON.stringify({ data }),
    });
    return result.id;
}

export async function updateOffer(id: string, data: Partial<SeasonalOffer>): Promise<void> {
    await apiFetch(`/api/data/offers/${id}`, {
        method: "PUT",
        body: JSON.stringify({ data }),
    });
}

export async function deleteOffer(id: string): Promise<void> {
    await apiFetch(`/api/data/offers/${id}`, { method: "DELETE" });
}

// ─── Audit Logs ─────────────────────────────────────────────────────────────

export async function logAccess(email: string, action: string): Promise<void> {
    await apiFetch("/api/data/logs", {
        method: "POST",
        body: JSON.stringify({ email, action }),
    });
}

export async function getLogs(): Promise<AuditLog[]> {
    return apiFetch<AuditLog[]>("/api/data/logs");
}
