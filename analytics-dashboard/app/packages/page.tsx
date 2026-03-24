import dynamic from "next/dynamic";

const PackagesClient = dynamic(
    () => import("@/components/table/PackagesClient").then(m => m.PackagesClient),
    { loading: () => <div className="p-8 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" /></div> }
);

export default function PackagesPage() {
    return <PackagesClient />;
}
