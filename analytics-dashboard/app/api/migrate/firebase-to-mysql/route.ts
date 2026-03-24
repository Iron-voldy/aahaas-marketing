import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import type { Row } from "@/lib/types";

/**
 * POST /api/migrate/firebase-to-mysql
 * 
 * Receives Firebase data from the client-side scrape page and inserts into MySQL.
 * Body: { packages: [...], offers: [...] }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { packages, offers } = body as { packages: any[]; offers: any[] };

        if (!packages && !offers) {
            return NextResponse.json({ error: "No data provided" }, { status: 400 });
        }

        const pool = getMysqlPool();
        const results = { packages: 0, offers: 0, errors: [] as string[] };

        // ── Insert packages ──────────────────────────────────────────────────
        if (packages && packages.length > 0) {
            console.log(`[migrate] Clearing pkg_data and inserting ${packages.length} packages...`);
            await pool.execute("DELETE FROM pkg_data");

            for (const pkg of packages) {
                try {
                    const firebaseId = pkg.id;
                    const { id, history, ...dataFields } = pkg;
                    const dataJson = JSON.stringify(dataFields);
                    const historyJson = history ? JSON.stringify(history) : null;

                    await pool.execute(
                        "INSERT INTO pkg_data (id, data, history) VALUES (?, ?, ?)",
                        [firebaseId, dataJson, historyJson]
                    );
                    results.packages++;
                    console.log(`[migrate] ✓ Package: ${dataFields.Package || dataFields.country || firebaseId}`);
                } catch (err: any) {
                    const msg = `Package ${pkg.id}: ${err.message}`;
                    results.errors.push(msg);
                    console.error(`[migrate] ✗ ${msg}`);
                }
            }
        }

        // ── Insert offers ────────────────────────────────────────────────────
        if (offers && offers.length > 0) {
            console.log(`[migrate] Clearing offer_data and inserting ${offers.length} offers...`);
            await pool.execute("DELETE FROM offer_data");

            for (const offer of offers) {
                try {
                    const firebaseId = offer.id;
                    const { id, ...dataFields } = offer;
                    const dataJson = JSON.stringify(dataFields);

                    await pool.execute(
                        "INSERT INTO offer_data (id, data) VALUES (?, ?)",
                        [firebaseId, dataJson]
                    );
                    results.offers++;
                    console.log(`[migrate] ✓ Offer: ${dataFields.name || firebaseId}`);
                } catch (err: any) {
                    const msg = `Offer ${offer.id}: ${err.message}`;
                    results.errors.push(msg);
                    console.error(`[migrate] ✗ ${msg}`);
                }
            }
        }

        console.log(`[migrate] Done! ${results.packages} packages, ${results.offers} offers migrated.`);
        return NextResponse.json(results);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[migrate] Fatal error:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
