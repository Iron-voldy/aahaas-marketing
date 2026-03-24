import dynamic from "next/dynamic";

const DashboardClient = dynamic(
    () => import("@/components/dashboard/DashboardClient").then(m => m.DashboardClient),
    { loading: () => <div className="p-8 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" /></div> }
);

export default function DashboardPage() {
    return <DashboardClient />;
}
