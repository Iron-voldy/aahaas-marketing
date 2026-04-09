import type { Row } from "@/lib/types";
import type { SeasonalOffer } from "@/lib/db";

export type ContentSourceFilter = "all" | "post" | "ads_campaign";
export type ContentSourceValue = Exclude<ContentSourceFilter, "all">;

export function normalizeContentSource(source: unknown): ContentSourceValue {
    const value = String(source ?? "").trim().toLowerCase();
    if (value === "ads_campaign" || value === "ads campaign" || value === "ads") {
        return "ads_campaign";
    }
    return "post";
}

export function getPackageSource(row: Row): ContentSourceValue {
    return normalizeContentSource(row.source);
}

export function getOfferSource(offer: SeasonalOffer): ContentSourceValue {
    return normalizeContentSource(offer.source);
}

export function matchesContentSource(
    source: ContentSourceValue,
    filter: ContentSourceFilter
): boolean {
    return filter === "all" || source === filter;
}

export function getContentSourceLabel(source: ContentSourceFilter | ContentSourceValue): string {
    if (source === "ads_campaign") return "Ads Campaign";
    if (source === "post") return "Post";
    return "All";
}
