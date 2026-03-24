import dynamic from "next/dynamic";

const InsightsClient = dynamic(
    () => import("@/components/insights/InsightsClient").then(m => m.InsightsClient),
    { loading: () => <div className="p-8 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" /></div> }
);

export default function InsightsPage() {
    return <InsightsClient />;
}
