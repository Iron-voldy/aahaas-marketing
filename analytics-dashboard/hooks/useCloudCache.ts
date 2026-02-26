"use client";

import { useState, useEffect } from "react";
import type { Row } from "@/lib/types";

export function useCloudCache(serverRows: Row[], serverLastUpdated: string | null) {
    const [rows, setRows] = useState<Row[]>(serverRows);
    const [lastUpdated, setLastUpdated] = useState<string | null>(serverLastUpdated);

    useEffect(() => {
        try {
            const cachedRows = localStorage.getItem("aahaas_cloud_cache_rows");
            const cachedDate = localStorage.getItem("aahaas_cloud_cache_date");

            if (cachedRows) {
                const parsed = JSON.parse(cachedRows);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setRows(parsed);
                }
            }
            if (cachedDate) {
                setLastUpdated(cachedDate);
            }
        } catch (error) {
            console.error("Failed to load cloud cache", error);
        }
    }, [serverRows, serverLastUpdated]);

    return { rows, lastUpdated };
}
