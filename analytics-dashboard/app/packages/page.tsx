import { loadCsv } from "@/lib/loadCsv";
import { inferSchema } from "@/lib/inferSchema";
import { PackagesClient } from "@/components/table/PackagesClient";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
    const rows = await loadCsv();
    const schema = inferSchema(rows);
    return <PackagesClient rows={rows} schema={schema} />;
}
