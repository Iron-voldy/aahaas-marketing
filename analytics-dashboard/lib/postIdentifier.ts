/**
 * Post Identifier & Matching Engine
 *
 * Pure logic (no I/O). Given parsed CSV rows and Firebase reference data,
 * identifies post categories and matches them to packages or seasonal offers.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type SourceType = "fb_post" | "fb_video" | "ig_post" | "ig_story";

export interface CsvPost {
    sourceType: SourceType;
    postId: string;
    pageOrAccountId: string;
    title: string;
    description: string;
    publishTime: string; // raw CSV string
    permalink: string;
    postType: string;
    reach: number;
    views: number;
    reactions: number;
    comments: number;
    shares: number;
    saves: number;
    totalClicks: number;
    linkClicks: number;
    otherClicks: number;
    threeSecViews: number;
    oneMinViews: number;
    secondsViewed: number;
    avgSecondsViewed: number;
    profileVisits: number;
    replies: number;
    navigation: number;
    follows: number;
    adImpressions: number;
    adCpm: number;
    estimatedEarnings: number;
}

export interface PackageRef {
    id: string;
    name: string;
    country: string;
    datePublished: string; // "16 December 2025, 14:30"
}

export interface OfferRef {
    id: string;
    name: string;
    category: string;
    datePublished: string;
}

export interface PostMatch {
    targetType: "package" | "seasonal_offer";
    targetId: string;
    matchMethod: "hashtag" | "date_country" | "title_keyword" | "date_proximity" | "manual" | "ai_match";
    confidence: number; // 0-100
}

export interface ProcessedPost extends CsvPost {
    parsedPublishTime: Date | null;
    detectedCategory: "package" | "seasonal_offer" | "general";
    detectedCountry: string | null;
    hasPackageHashtag: boolean;
    hashtags: string[];
    match: PostMatch | null;
}

export interface PackageUpdate {
    packageId: string;
    packageCountry: string;
    packageDate: string;
    metrics: Record<string, number>;
    postUrls: { fb?: string; ig?: string };
    matchedPosts: Array<{
        sourceType: SourceType;
        postId: string;
        title: string;
        publishTime: string;
        matchMethod: string;
        confidence: number;
        reach: number;
    }>;
}

export interface OfferUpdate {
    offerId: string;
    offerName: string;
    offerCategory: string;
    metrics: Record<string, number>;
    postUrls: { fb?: string; ig?: string };
    matchedPosts: Array<{
        sourceType: SourceType;
        postId: string;
        title: string;
        publishTime: string;
        matchMethod: string;
        confidence: number;
        reach: number;
    }>;
}

export interface ImportResult {
    processedPosts: ProcessedPost[];
    packageUpdates: PackageUpdate[];
    offerUpdates: OfferUpdate[];
    stats: {
        total: number;
        fbPosts: number;
        fbVideos: number;
        igPosts: number;
        igStories: number;
        packagePosts: number;
        offerPosts: number;
        generalPosts: number;
        matched: number;
        unmatched: number;
    };
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Map country label → keywords that identify that country in post text */
const COUNTRY_KEYWORDS: Record<string, string[]> = {
    Singapore: ["singapore", "sentosa", "marina bay", "universal studios singapore"],
    Malaysia: ["malaysia", "kuala lumpur", "langkawi", "penang", "genting", "batu caves", "kl tour"],
    "Malaysia - Langkawi": ["langkawi"],
    Maldives: ["maldives", "canareef"],
    "India - Kerala": ["kerala", "backwater", "alleppey", "kochi"],
    India: ["india", "kerala", "rajasthan", "goa"],
    Thailand: ["thailand", "bangkok", "phuket", "chiang mai"],
    Dubai: ["dubai", "abu dhabi", "uae"],
    Japan: ["japan", "tokyo", "osaka", "kyoto"],
    Bali: ["bali", "indonesia"],
    Vietnam: ["vietnam", "hanoi", "ho chi minh"],
    "Sri Lanka": ["sri lanka", "colombo", "kandy", "galle"],
};

/** Keywords that indicate a post is about a travel package */
const PACKAGE_KEYWORDS = [
    "tour package", "tour –", "tour -", "island escape",
    "honeymoon tour", "honeymoon package",
    "getaway", "vip tour", "wonder tour",
    "overseas package", "overseaspackage",
    "per person", "per pax", "per adult",
    "min 2 pax", "min 3 pax",
    "book before", "book now", "book your",
    "starting at just", "starting from",
    "accommodation", "hotel stay",
    "airport transfer", "transfers included",
    // NOTE: "visa assistance" intentionally removed — it also fires on standalone
    // visa-service promotions (e.g. "Apply for Japan visa today") which are general posts.
    // Package posts that mention visa assistance will still be caught by their
    // nights/days pattern or price signal.
    "visa included",
    "flight included", "including flights",
    "all inclusive", "all-inclusive",
    "#package", "#overseaspackages", "#travelwithaahaas", "#explorewithaahaas",
    "#tourpackage", "#travelpackage", "#tourismpackage",
];

/** Keywords that indicate a post is about a seasonal offer */
const OFFER_KEYWORDS = [
    "buffet", "dinner buffet", "lunch buffet", "dinner", "lunch", "brunch", "high tea",
    "spa", "wellness", "glow",
    "iftar", "eid feast", "eid celebration", "eid dining", "eid special",
    "day out", "staycation", "room offer",
    "valentine", "women's day", "ramadan",
    "cinnamon grand", "cinnamon lakeside", "cinnamon red",
    "per adult", "per child",
];

/** Keywords for general/non-matchable posts (skip) */
const GENERAL_KEYWORDS = [
    "visa", "e-visa", "schengen",
    "feedback", "customer review", "real stories",
    "happy pongal", "merry christmas", "happy new year",
    "independence day", "chinese new year",
    "mahashivaratri", "holi", "ramadan kareem",
];

/** Offer keyword → category mapping */
const OFFER_CATEGORY_MAP: Record<string, string> = {
    buffet: "Buffet",
    dinner: "Dining Offer",
    lunch: "Dining Offer",
    brunch: "Buffet",
    "high tea": "Dining Offer",
    spa: "Spa",
    wellness: "Spa",
    glow: "Spa",
    iftar: "Dining Offer",
    "eid feast": "Dining Offer",
    "eid celebration": "Dining Offer",
    "eid dining": "Dining Offer",
    "day out": "Weekend Getaway",
    staycation: "Staycation",
    "room offer": "Room Offer",
    valentine: "Seasonal Promotion",
    "women's day": "Seasonal Promotion",
};

// ─── Date Parsing ────────────────────────────────────────────────────────────

/** Parse CSV "Publish time" format: "MM/DD/YYYY HH:MM" */
export function parsePublishTime(raw: string): Date | null {
    if (!raw) return null;
    // "12/16/2025 01:00"
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return new Date(+m[3], +m[1] - 1, +m[2], +m[4], +m[5]);
}

/** Parse Firebase package "Date Published" in various formats */
export function parsePackageDate(raw: string): Date | null {
    if (!raw) return null;
    // Format 1: "16 December 2025, 14:30"
    const m = raw.match(/^(\d{1,2})\s+(\w+)\s+(\d{4}),?\s*(\d{1,2}):(\d{2})$/);
    if (m) {
        const months: Record<string, number> = {
            january: 0, february: 1, march: 2, april: 3,
            may: 4, june: 5, july: 6, august: 7,
            september: 8, october: 9, november: 10, december: 11,
        };
        const mon = months[m[2].toLowerCase()];
        if (mon !== undefined) {
            return new Date(+m[3], mon, +m[1], +m[4], +m[5]);
        }
    }
    // Format 2: "DD-MM-YYYY" or "DD/MM/YYYY" (e.g. "16-12-2025", "02-02-2026")
    const dm = raw.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/);
    if (dm) {
        return new Date(+dm[3], +dm[2] - 1, +dm[1]);
    }
    // Fallback: try native parsing
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

/** Check if two dates are on the same calendar day */
function sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

/** Check if two dates are within N days of each other */
function withinDays(a: Date, b: Date, n: number): boolean {
    const diff = Math.abs(a.getTime() - b.getTime());
    return diff <= n * 24 * 60 * 60 * 1000;
}

// ─── Post Identification ─────────────────────────────────────────────────────

/** Extract all #hashtags from text */
function extractHashtags(text: string): string[] {
    return (text.match(/#\w+/g) || []).map((h) => h.toLowerCase());
}

/** Detect the country referenced by a post's text */
export function detectCountry(text: string): string | null {
    const lower = text.toLowerCase();
    // Check specific sub-destinations first
    if (lower.includes("langkawi")) return "Malaysia - Langkawi";
    if (lower.includes("kerala") || lower.includes("alleppey")) return "India - Kerala";

    for (const [country, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
        if (country.includes(" - ")) continue; // Skip sub-destinations (checked above)
        if (keywords.some((k) => lower.includes(k))) return country;
    }
    return null;
}

/** Identify whether a post is a package, offer, or general content */
export function identifyCategory(text: string): "package" | "seasonal_offer" | "general" {
    const lower = text.toLowerCase();

    // 1. Explicit #package hashtag → package
    if (lower.includes("#package")) return "package";

    // 2. Check keyword presence
    const isGeneral = GENERAL_KEYWORDS.some((k) => lower.includes(k));
    const hasPackageKw = PACKAGE_KEYWORDS.some((k) => lower.includes(k));
    const hasOfferKw = OFFER_KEYWORDS.some((k) => lower.includes(k));
    const hasCountry = detectCountry(text) !== null;

    // 3. "N Nights / M Days", "3N/4D", "4D/3N", or "3D2N" pattern — strong package signal
    //    normalizeDuration() converts "3N/4D" → "3n4d" so we test the normalized form too.
    const normalizedText = normalizeDuration(text);
    const hasNightsDaysPattern = /\d+\s*nights?\s*[\/|&,]\s*\d+\s*days?/i.test(text)
        || /\d+\s*nights?/i.test(lower)
        || /\d+\s*[dn]\s*\d+\s*[dn]/i.test(text)         // 3D2N, 2N3D, 4D3N (no separator)
        || /\d+n\d+d|\d+d\d+n/i.test(normalizedText)      // 3N/4D, 4D/3N after normalization
        || /\d+\s*[Nn][\/\\]\d+\s*[Dd]/i.test(text)       // 3N/4D, 4N\5D (raw slash)
        || /\d+\s*[Dd][\/\\]\d+\s*[Nn]/i.test(text);      // 4D/3N, 3D\2N (raw slash)

    // 4. Price pattern (PKR/LKR/USD/Rs + amount) — strong commercial signal
    const hasPricePattern = /(?:lkr|usd|pkr|inr|myr|sgd|aed|bdt|rs\.?)\s*[\d,]+|[\d,]+\s*(?:pkr|lkr|usd|sgd)|per\s*pax|per\s*person|per\s*adult/i.test(text);

    // 5. GENERAL HARD OVERRIDE: posts that are clearly general (visa services, holiday
    //    greetings, testimonials) should never be classified as packages — UNLESS they
    //    also have a nights/days pattern or price signal, which would indicate the post
    //    is a package that merely MENTIONS visa assistance as an included feature.
    //    Example blocked: "Apply for Japan visa today. #JapanVisa"  (visa + Japan)
    //    Example allowed: "Singapore 4N/5D - visa included. LKR 45,000"  (nights + price)
    if (isGeneral && !hasNightsDaysPattern && !hasPricePattern) return "general";

    // 6. Package detection: keywords + country, or nights pattern + country, or price + country
    if (hasPackageKw && hasCountry) return "package";
    if (hasNightsDaysPattern && hasCountry) return "package";
    if (hasPricePattern && hasCountry && !hasOfferKw) return "package";

    // 7. Offer detection
    if (hasOfferKw) return "seasonal_offer";

    // 8. Country mention + pricing (without offer keywords) → likely package
    if (hasCountry && hasPricePattern) return "package";

    return "general";
}

// ─── Matching ────────────────────────────────────────────────────────────────

/** Check if a post's country matches a package's country field */
function countryMatches(packageCountry: string, postCountry: string | null): boolean {
    if (!postCountry) return false;
    const pkgLower = packageCountry.toLowerCase();
    const postLower = postCountry.toLowerCase();
    // Direct match
    if (pkgLower === postLower) return true;
    // Sub-destination match: "Malaysia - Langkawi" matches "Malaysia"
    if (pkgLower.includes(postLower) || postLower.includes(pkgLower)) return true;
    // Both reference the same base country
    const pkgBase = pkgLower.split(" - ")[0].trim();
    const postBase = postLower.split(" - ")[0].trim();
    return pkgBase === postBase;
}

/**
 * Normalize duration shorthand BEFORE character stripping so tokens like
 * 3N/4D, 4D/3N, 3Nights/4Days all become a single comparable string "3n4d".
 * This is the KEY fix: without this, "3n" and "4d" are 2-char tokens that get
 * filtered out, making every same-country package score identically.
 */
function normalizeDuration(s: string): string {
    return s
        // "3N/4D", "3N4D", "3 N / 4 D" → "3n4d"
        .replace(/(\d+)\s*[Nn]\s*[\/\\\-]?\s*(\d+)\s*[Dd]/g, (_, n, d) => `${n}n${d}d`)
        // "4D/3N", "4D3N", "4 Days 3 Nights" → "4d3n"
        .replace(/(\d+)\s*[Dd]\s*[\/\\\-]?\s*(\d+)\s*[Nn]/g, (_, d, n) => `${d}d${n}n`)
        // "3 Nights / 4 Days" → "3n4d" (with full words)
        .replace(/(\d+)\s*nights?\s*[\/|&,]?\s*(\d+)\s*days?/gi, (_, n, d) => `${n}n${d}d`)
        // "4 Days / 3 Nights" → "4d3n"
        .replace(/(\d+)\s*days?\s*[\/|&,]?\s*(\d+)\s*nights?/gi, (_, d, n) => `${d}d${n}n`);
}

/**
 * Compute how well a package name matches the post text.
 * Returns a score 0-1 (fraction of package name words found in post text).
 */
function nameMatchScore(packageName: string, postText: string): number {
    if (!packageName || !postText) return 0;

    // Normalize: fix duration tokens FIRST, then strip specials
    const normalize = (s: string) => normalizeDuration(s)
        .toLowerCase()
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const pkgNorm = normalize(packageName);
    const postNorm = normalize(postText);

    // Skip common travel words; keep duration tokens like "3n4d", "4n5d"
    const skipWords = new Set(["the", "and", "for", "with", "from", "tour", "package",
        "days", "day", "nights", "night", "pax", "pkg"]);
    // Use length >= 3 to include duration tokens ("3n4d" = 4 chars) but skip 2-char noise
    const pkgWords = pkgNorm.split(/\s+/).filter(w => w.length >= 3 && !skipWords.has(w));
    if (pkgWords.length === 0) return 0;

    let found = 0;
    for (const word of pkgWords) {
        if (postNorm.includes(word)) found++;
    }
    return found / pkgWords.length;
}

/** Find the best matching package for a post */
function findPackageMatch(
    post: ProcessedPost,
    packages: PackageRef[],
): PostMatch | null {
    if (!post.parsedPublishTime) return null;
    const postDate = post.parsedPublishTime;
    const postText = [post.title, post.description].filter(Boolean).join(" ");

    // Pre-compute all package dates once
    const pkgWithDates = packages.map(pkg => ({
        pkg,
        date: parsePackageDate(pkg.datePublished),
    }));


    // ── Strategy 0 (STRICT): Package name found in post text + DATE within ±3 days ──
    // After normalizeDuration fix, "3N/4D" becomes "3n4d" and differentiates packages
    // that differ only by duration. Sort: score DESC, then date proximity ASC (tiebreaker).
    const nameMatches = pkgWithDates
        .map(({ pkg, date }) => ({
            pkg,
            date,
            score: nameMatchScore(pkg.name, postText),
            matchesCountry: countryMatches(pkg.country, post.detectedCountry),
            withinDate: date ? withinDays(date, postDate, 3) : false,
            dayDiff: date ? Math.abs(date.getTime() - postDate.getTime()) : Infinity,
        }))
        .filter(c => c.score >= 0.5 && c.withinDate)
        // Sort: highest score first; then closest date first as tiebreaker
        .sort((a, b) => {
            if (Math.abs(a.score - b.score) > 0.05) return b.score - a.score;
            return a.dayDiff - b.dayDiff;
        });

    if (nameMatches.length > 0) {
        const best = nameMatches[0];
        if (best.score >= 0.7 && best.matchesCountry) {
            return { targetType: "package", targetId: best.pkg.id, matchMethod: "title_keyword", confidence: 95 };
        }
        if (best.score >= 0.6 && best.matchesCountry) {
            return { targetType: "package", targetId: best.pkg.id, matchMethod: "title_keyword", confidence: 88 };
        }
        if (best.score >= 0.5) {
            return { targetType: "package", targetId: best.pkg.id, matchMethod: "title_keyword", confidence: 80 };
        }
    }

    // ── Strategy 1: Same day + same country ──
    let candidates = pkgWithDates
        .filter(({ pkg, date }) => date && sameDay(date, postDate) && countryMatches(pkg.country, post.detectedCountry));

    if (candidates.length === 1) {
        return { targetType: "package", targetId: candidates[0].pkg.id, matchMethod: "date_country", confidence: 95 };
    }
    if (candidates.length > 1) {
        // Multiple packages same day+country: use nameMatchScore (now duration-aware) to disambiguate
        const scored = candidates.map(c => ({
            ...c,
            nameScore: nameMatchScore(c.pkg.name, postText),
        })).sort((a, b) => {
            // Prefer higher name match, then closer time
            if (Math.abs(a.nameScore - b.nameScore) > 0.05) return b.nameScore - a.nameScore;
            const da = Math.abs(a.date!.getTime() - postDate.getTime());
            const db = Math.abs(b.date!.getTime() - postDate.getTime());
            return da - db;
        });
        // Only high-confidence if best nameScore clearly differentiates
        const conf = scored[0].nameScore >= 0.6 ? 88 : 75;
        return { targetType: "package", targetId: scored[0].pkg.id, matchMethod: "date_country", confidence: conf };
    }

    // ── Strategy 2: ±1 day + same country ──
    candidates = pkgWithDates
        .filter(({ pkg, date }) => date && withinDays(date, postDate, 1) && countryMatches(pkg.country, post.detectedCountry));

    if (candidates.length >= 1) {
        const scored = candidates.map(c => ({
            ...c,
            nameScore: nameMatchScore(c.pkg.name, postText),
        })).sort((a, b) => {
            if (Math.abs(a.nameScore - b.nameScore) > 0.1) return b.nameScore - a.nameScore;
            const da = Math.abs(a.date!.getTime() - postDate.getTime());
            const db = Math.abs(b.date!.getTime() - postDate.getTime());
            return da - db;
        });
        return { targetType: "package", targetId: scored[0].pkg.id, matchMethod: "date_country", confidence: 70 };
    }

    // ── Strategy 3: ±2 days + same country (for timezone gaps) ──
    candidates = pkgWithDates
        .filter(({ pkg, date }) => date && withinDays(date, postDate, 2) && countryMatches(pkg.country, post.detectedCountry));

    if (candidates.length >= 1) {
        const scored = candidates.map(c => ({
            ...c,
            nameScore: nameMatchScore(c.pkg.name, postText),
        })).sort((a, b) => {
            if (Math.abs(a.nameScore - b.nameScore) > 0.1) return b.nameScore - a.nameScore;
            const da = Math.abs(a.date!.getTime() - postDate.getTime());
            const db = Math.abs(b.date!.getTime() - postDate.getTime());
            return da - db;
        });
        // Only accept ±2 day match if name also has some overlap or there's just one candidate
        if (scored.length === 1 || scored[0].nameScore > 0.2) {
            return { targetType: "package", targetId: scored[0].pkg.id, matchMethod: "date_proximity", confidence: 55 };
        }
    }

    return null;
}

/** Find the best matching offer for a post */
function findOfferMatch(
    post: ProcessedPost,
    offers: OfferRef[],
): PostMatch | null {
    if (!post.parsedPublishTime || offers.length === 0) return null;
    const postDate = post.parsedPublishTime;
    const text = (post.title + " " + post.description).toLowerCase();

    // Detect offer category from keywords
    let detectedOfferCategory: string | null = null;
    for (const [keyword, category] of Object.entries(OFFER_CATEGORY_MAP)) {
        if (text.includes(keyword)) {
            detectedOfferCategory = category;
            break;
        }
    }

    // Strategy 1: Same day + same category
    if (detectedOfferCategory) {
        const candidates = offers.filter((o) => {
            const oDate = parsePackageDate(o.datePublished) || parsePublishTime(o.datePublished);
            if (!oDate) return false;
            return sameDay(oDate, postDate) && o.category === detectedOfferCategory;
        });
        if (candidates.length >= 1) {
            return { targetType: "seasonal_offer", targetId: candidates[0].id, matchMethod: "date_country", confidence: 85 };
        }
    }

    // Strategy 2: Same day with any offer (±1 day)
    const dayCandidates = offers.filter((o) => {
        const oDate = parsePackageDate(o.datePublished) || parsePublishTime(o.datePublished);
        return oDate && withinDays(oDate, postDate, 1);
    });
    if (dayCandidates.length >= 1) {
        return { targetType: "seasonal_offer", targetId: dayCandidates[0].id, matchMethod: "date_proximity", confidence: 60 };
    }

    // Strategy 3: Keyword match only (category matches, no date constraint) — low confidence
    if (detectedOfferCategory) {
        const catCandidates = offers.filter((o) => o.category === detectedOfferCategory);
        if (catCandidates.length >= 1) {
            return { targetType: "seasonal_offer", targetId: catCandidates[0].id, matchMethod: "title_keyword", confidence: 40 };
        }
    }

    return null;
}

// ─── Main Processing ─────────────────────────────────────────────────────────

/** Process all parsed CSV posts: identify categories, match to packages/offers */
export function processImport(
    posts: CsvPost[],
    packages: PackageRef[],
    offers: OfferRef[],
): ImportResult {
    // Step 1: Enrich each post with identification data
    const processedPosts: ProcessedPost[] = posts.map((post) => {
        const fullText = [post.title, post.description].filter(Boolean).join(" ");
        const hashtags = extractHashtags(fullText);
        const parsedPublishTime = parsePublishTime(post.publishTime);
        const detectedCategory = identifyCategory(fullText);
        const detectedCountry = detectCountry(fullText);
        const hasPackageHashtag = hashtags.includes("#package");

        return {
            ...post,
            parsedPublishTime,
            detectedCategory,
            detectedCountry,
            hasPackageHashtag,
            hashtags,
            match: null,
        };
    });

    // Step 2: Match posts to packages/offers
    for (const post of processedPosts) {
        if (post.detectedCategory === "package") {
            post.match = findPackageMatch(post, packages);
        } else if (post.detectedCategory === "seasonal_offer") {
            post.match = findOfferMatch(post, offers);
        }
    }

    // Step 3: Cross-platform matching — for IG posts that weren't matched,
    // try to link them to the same package as an already-matched FB post
    // published on the same day with matching country.
    const matchedFbPosts = processedPosts.filter(
        (p) => (p.sourceType === "fb_post" || p.sourceType === "fb_video") && p.match,
    );

    for (const post of processedPosts) {
        if (post.match) continue;
        if (post.sourceType !== "ig_post" && post.sourceType !== "ig_story") continue;
        // Include if non-general OR if general but has a country hint (misclassified)
        if (post.detectedCategory === "general" && !post.detectedCountry) continue;
        if (!post.parsedPublishTime) continue;

        // Find FB post matched to a package on the same day (±2 days) with matching country
        const crossMatch = matchedFbPosts.find((fb) => {
            if (!fb.parsedPublishTime) return false;
            if (!withinDays(fb.parsedPublishTime, post.parsedPublishTime!, 2)) return false;
            // Prefer same country match, but allow if post has no detected country
            if (post.detectedCountry && fb.detectedCountry) {
                return countryMatches(fb.detectedCountry, post.detectedCountry);
            }
            return true;
        });

        if (crossMatch?.match) {
            post.match = {
                ...crossMatch.match,
                matchMethod: "date_proximity",
                confidence: Math.min(crossMatch.match.confidence, 65),
            };
            // Promote category if cross-matched
            if (post.detectedCategory === "general") {
                post.detectedCategory = crossMatch.detectedCategory;
                post.detectedCountry = post.detectedCountry ?? crossMatch.detectedCountry;
            }
        }
    }

    // Step 3b: Looser cross-platform — IG posts still unmatched within ±1 day of matched FB
    // (handles very short IG captions that pass no category/country signals)
    const matchedFbByDate = matchedFbPosts.filter((p) => p.parsedPublishTime);
    for (const post of processedPosts) {
        if (post.match) continue;
        if (post.sourceType !== "ig_post" && post.sourceType !== "ig_story") continue;
        if (!post.parsedPublishTime) continue;

        const strictCrossMatch = matchedFbByDate.find((fb) =>
            withinDays(fb.parsedPublishTime!, post.parsedPublishTime!, 1)
        );
        if (strictCrossMatch?.match) {
            post.match = {
                ...strictCrossMatch.match,
                matchMethod: "date_proximity",
                confidence: Math.min(strictCrossMatch.match.confidence, 45),
            };
            post.detectedCategory = strictCrossMatch.detectedCategory;
            post.detectedCountry = post.detectedCountry ?? strictCrossMatch.detectedCountry;
        }
    }

    // Step 4: Aggregate updates per package
    const packageUpdates = aggregatePackageUpdates(processedPosts, packages);
    const offerUpdates = aggregateOfferUpdates(processedPosts, offers);

    // Step 5: Stats
    const stats = {
        total: processedPosts.length,
        fbPosts: processedPosts.filter((p) => p.sourceType === "fb_post").length,
        fbVideos: processedPosts.filter((p) => p.sourceType === "fb_video").length,
        igPosts: processedPosts.filter((p) => p.sourceType === "ig_post").length,
        igStories: processedPosts.filter((p) => p.sourceType === "ig_story").length,
        packagePosts: processedPosts.filter((p) => p.detectedCategory === "package").length,
        offerPosts: processedPosts.filter((p) => p.detectedCategory === "seasonal_offer").length,
        generalPosts: processedPosts.filter((p) => p.detectedCategory === "general").length,
        matched: processedPosts.filter((p) => p.match !== null).length,
        unmatched: processedPosts.filter((p) => p.detectedCategory !== "general" && p.match === null).length,
    };

    return { processedPosts, packageUpdates, offerUpdates, stats };
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

function aggregatePackageUpdates(posts: ProcessedPost[], packages: PackageRef[]): PackageUpdate[] {
    // Group matched posts by package ID
    const groups = new Map<string, ProcessedPost[]>();
    for (const post of posts) {
        if (post.match?.targetType !== "package") continue;
        const id = post.match.targetId;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id)!.push(post);
    }

    const updates: PackageUpdate[] = [];
    for (const [pkgId, matchedPosts] of groups) {
        const pkg = packages.find((p) => p.id === pkgId);
        if (!pkg) continue;

        // Only use posts whose publish date matches package date (±3 days)
        const pkgDate = parsePackageDate(pkg.datePublished);
        const fbPost = matchedPosts.find((p) =>
            (p.sourceType === "fb_post" || p.sourceType === "fb_video") &&
            pkgDate && p.parsedPublishTime && withinDays(pkgDate, p.parsedPublishTime, 3)
        );
        const igPost = matchedPosts.find((p) =>
            (p.sourceType === "ig_post" || p.sourceType === "ig_story") &&
            pkgDate && p.parsedPublishTime && withinDays(pkgDate, p.parsedPublishTime, 3)
        );

        const metrics: Record<string, number> = {};

        if (fbPost) {
            metrics["FB Reach"] = fbPost.reach;
            metrics["FB Interactions (Reactions)"] = fbPost.reactions;
            metrics["FB Interactions (Comments)"] = fbPost.comments;
            metrics["FB Interactions (Shares)"] = fbPost.shares;
            metrics["FB Interactions (Saves)"] = fbPost.saves;
            metrics["FB Total Clicks"] = fbPost.totalClicks;
            metrics["FB Link Clicks"] = fbPost.linkClicks;
        }
        if (igPost) {
            metrics["IG Reach"] = igPost.reach;
            metrics["IG Interactions (Reactions)"] = igPost.reactions;
            metrics["IG Interactions (Comments)"] = igPost.comments;
            metrics["IG Interactions (Shares)"] = igPost.shares;
            metrics["IG Interactions (Saves)"] = igPost.saves;
        }

        const fbReach = metrics["FB Reach"] ?? 0;
        const igReach = metrics["IG Reach"] ?? 0;
        metrics["Combined Reach"] = fbReach + igReach;

        updates.push({
            packageId: pkgId,
            packageCountry: pkg.country,
            packageDate: pkg.datePublished,
            metrics,
            postUrls: {
                fb: fbPost?.permalink || undefined,
                ig: igPost?.permalink || undefined,
            },
            matchedPosts: matchedPosts.map((p) => ({
                sourceType: p.sourceType,
                postId: p.postId,
                title: (p.title || p.description || "").slice(0, 100),
                publishTime: p.publishTime,
                matchMethod: p.match!.matchMethod,
                confidence: p.match!.confidence,
                reach: p.reach,
            })),
        });
    }

    return updates;
}

function aggregateOfferUpdates(posts: ProcessedPost[], offers: OfferRef[]): OfferUpdate[] {
    const groups = new Map<string, ProcessedPost[]>();
    for (const post of posts) {
        if (post.match?.targetType !== "seasonal_offer") continue;
        const id = post.match.targetId;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id)!.push(post);
    }

    const updates: OfferUpdate[] = [];
    for (const [offerId, matchedPosts] of groups) {
        const offer = offers.find((o) => o.id === offerId);
        if (!offer) continue;

        const fbPost = matchedPosts.find((p) => p.sourceType === "fb_post")
            || matchedPosts.find((p) => p.sourceType === "fb_video");
        const igPost = matchedPosts.find((p) => p.sourceType === "ig_post")
            || matchedPosts.find((p) => p.sourceType === "ig_story");

        const metrics: Record<string, number> = {};

        if (fbPost) {
            metrics.fbReach = fbPost.reach;
            metrics.fbReactions = fbPost.reactions;
            metrics.fbComments = fbPost.comments;
            metrics.fbShares = fbPost.shares;
            metrics.fbClicks = fbPost.totalClicks;
        }
        if (igPost) {
            metrics.igReach = igPost.reach;
            metrics.igReactions = igPost.reactions;
            metrics.igComments = igPost.comments;
            metrics.igShares = igPost.shares;
            metrics.igSaves = igPost.saves;
        }

        metrics.combinedReach = (metrics.fbReach ?? 0) + (metrics.igReach ?? 0);

        updates.push({
            offerId,
            offerName: offer.name,
            offerCategory: offer.category,
            metrics,
            postUrls: {
                fb: fbPost?.permalink || undefined,
                ig: igPost?.permalink || undefined,
            },
            matchedPosts: matchedPosts.map((p) => ({
                sourceType: p.sourceType,
                postId: p.postId,
                title: (p.title || p.description || "").slice(0, 100),
                publishTime: p.publishTime,
                matchMethod: p.match!.matchMethod,
                confidence: p.match!.confidence,
                reach: p.reach,
            })),
        });
    }

    return updates;
}
