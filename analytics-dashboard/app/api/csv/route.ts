import { NextResponse } from "next/server";
import { loadCsv } from "@/lib/loadCsv";

export async function GET() {
    try {
        const { rows } = await loadCsv();
        return NextResponse.json({ rows });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
