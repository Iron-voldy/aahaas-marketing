import { NextResponse } from "next/server";
import { loadCsv } from "@/lib/loadCsv";
import { addPackage } from "@/lib/firebase/db";
import { Row } from "@/lib/types";

export async function POST() {
    try {
        console.log("Starting CSV to Firestore migration...");
        const { rows } = await loadCsv();

        let count = 0;
        let errors = 0;

        for (const row of rows) {
            try {
                // Remove the undefined/id before pushing if any
                const { id, ...cleanRow } = row;
                await addPackage(cleanRow as Row);
                count++;
            } catch (err) {
                console.error("Failed to add row:", row.Package, err);
                errors++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Migration completed. Uploaded ${count} packages. Errors: ${errors}.`
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
