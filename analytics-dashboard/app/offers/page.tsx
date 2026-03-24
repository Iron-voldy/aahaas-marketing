import dynamic from "next/dynamic";

const OffersClient = dynamic(
    () => import("@/components/offers/OffersClient").then(m => m.OffersClient),
    { loading: () => <div className="p-8 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" /></div> }
);

export const metadata = {
    title: "Seasonal Offers | Aahaas Analytics",
    description: "Manage and track the performance of seasonal offers — spa, buffet, weekend getaways, and more.",
};

export default function OffersPage() {
    return <OffersClient />;
}
