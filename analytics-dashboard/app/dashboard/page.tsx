import { loadCsv } from "@/lib/loadCsv";
import { inferSchema } from "@/lib/inferSchema";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
    const rows = await loadCsv();
    const schema = inferSchema(rows);

    return <DashboardClient rows={rows} schema={schema} />;
}
