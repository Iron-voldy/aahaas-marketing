import dynamic from "next/dynamic";

export const metadata = {
    title: "Ads Campaigns | Aahaas Analytics",
    description: "Track Facebook & Instagram ad campaign performance — spend, reach, CTR, conversions, and more.",
};

const AdsClient = dynamic(
    () => import("@/components/ads/AdsClient").then((m) => m.AdsClient),
    {
        loading: () => (
            <div className="p-8 flex justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        ),
    }
);

export default function AdsPage() {
    return <AdsClient />;
}
