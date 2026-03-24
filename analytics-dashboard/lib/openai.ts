/**
 * OpenAI-powered post-to-package/offer matching.
 *
 * Given a batch of social-media post descriptions and a list of known
 * packages / offers, returns structured match suggestions.
 */

import type { PackageRef, OfferRef, SourceType } from "./postIdentifier";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PostForAI {
    index: number;
    sourceType: SourceType;
    postId: string;
    title: string;
    description: string;
    publishTime: string;
    permalink: string;
}

export interface AIMatchResult {
    index: number;
    category: "package" | "seasonal_offer" | "general";
    matchedId: string | null;
    matchedName: string | null;
    confidence: number; // 0-100
    reason: string;
    detectedCountry: string | null;
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Send a batch of posts to OpenAI and get matching suggestions.
 * Falls back gracefully if the API key is missing or the call fails.
 */
export async function matchPostsWithAI(
    posts: PostForAI[],
    packages: PackageRef[],
    offers: OfferRef[],
): Promise<AIMatchResult[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn("[openai] No OPENAI_API_KEY set, skipping AI matching");
        return [];
    }

    // Limit batch size to avoid token overflow
    const MAX_BATCH = 50;
    const batches: PostForAI[][] = [];
    for (let i = 0; i < posts.length; i += MAX_BATCH) {
        batches.push(posts.slice(i, i + MAX_BATCH));
    }

    const allResults: AIMatchResult[] = [];

    for (const batch of batches) {
        try {
            const results = await callOpenAI(batch, packages, offers, apiKey);
            allResults.push(...results);
        } catch (err) {
            console.error("[openai] Batch failed:", err);
            // Continue with next batch
        }
    }

    return allResults;
}

// ─── OpenAI Call ─────────────────────────────────────────────────────────────

async function callOpenAI(
    posts: PostForAI[],
    packages: PackageRef[],
    offers: OfferRef[],
    apiKey: string,
): Promise<AIMatchResult[]> {
    const packageList = packages.map((p) =>
        `  - ID: "${p.id}", Name: "${p.name}", Country: "${p.country}", Published: "${p.datePublished}"`
    ).join("\n");

    const offerList = offers.map((o) =>
        `  - ID: "${o.id}", Name: "${o.name}", Category: "${o.category}", Published: "${o.datePublished}"`
    ).join("\n");

    const postList = posts.map((p) => {
        const text = [p.title, p.description].filter(Boolean).join(" ").slice(0, 300);
        return `  ${p.index}. [${p.sourceType}] Published: ${p.publishTime} | Text: "${text}"`;
    }).join("\n");

    const systemPrompt = `You are a social media analytics expert for "Aahaas", a Sri Lankan travel & hospitality company.
Your job is to match social media posts to either travel PACKAGES or seasonal OFFERS.

PACKAGES are destination-specific travel posts (e.g., "Singapore Tour Package", "Malaysia 3N/4D").
OFFERS are hotel/restaurant promotions (e.g., "Buffet Night", "Spa Weekend", "Happy Hour").
GENERAL posts are unrelated content (visa services, greetings, customer reviews) — mark as "general".

Key matching rules:
1. Match by COUNTRY keywords + PUBLISH DATE proximity for packages. The post publish date MUST be within ±3 days of the package published date. NEVER match a post to a package if the dates are more than 3 days apart.
2. Match by CATEGORY keywords + PUBLISH DATE for offers.
3. A post about a specific country tour IS a package post.
4. A post about food/dining/spa/staycation IS an offer post.
5. IG stories that are very short (no description) posted same day as another matched post likely belong to the same package/offer.
6. Generic holiday greetings, visa promotions, testimonials = "general".
7. CRITICAL: If multiple packages exist for the same country (e.g. "Singapore 3N/4D - 003" on 16-12-2025 and "Singapore 3N/4D - 005" on 02-02-2026), you MUST match based on the CLOSEST date. A post from Dec 2025 CANNOT match a package from Feb 2026.
8. If no package has a date within ±3 days of the post date, return null for matchedId.

Return a JSON array of objects with these fields:
- index: the post number from my list
- category: "package" | "seasonal_offer" | "general"
- matchedId: the ID from packages/offers list, or null if general/no match
- matchedName: the name of matched package/offer, or null
- confidence: 0-100
- reason: brief explanation (max 20 words)
- detectedCountry: country name if detected, or null`;

    const userPrompt = `KNOWN PACKAGES:
${packageList || "  (none)"}

KNOWN OFFERS:
${offerList || "  (none)"}

POSTS TO CLASSIFY:
${postList}

Return ONLY a JSON array, no markdown fences, no explanation outside the array.`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.1,
            max_tokens: 4000,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
        }),
    });

    if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`OpenAI API error ${resp.status}: ${errBody}`);
    }

    const data = await resp.json();
    const content: string = data.choices?.[0]?.message?.content || "[]";

    // Parse JSON (strip markdown fences if present)
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed: AIMatchResult[] = JSON.parse(cleaned);

    return parsed;
}
