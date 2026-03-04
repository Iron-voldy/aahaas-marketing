import { db } from "./config";
import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy
} from "firebase/firestore";
import type { Row } from "@/lib/types";

// The name of our Firestore collections
const PACKAGES_COLLECTION = "packages";
const OFFERS_COLLECTION = "seasonal_offers";
const LOGS_COLLECTION = "audit_logs";

export interface AuditLog {
    id?: string;
    email: string;
    action: string;
    timestamp: string;
}

/**
 * Fetch all packages from Firestore, ordered by 'package' name.
 * We cast the result to our existing `Row` type to maintain compatibility with the UI.
 */
export async function getPackages(): Promise<Row[]> {
    const q = query(collection(db, PACKAGES_COLLECTION), orderBy("Package"));
    const querySnapshot = await getDocs(q);

    const packages: Row[] = [];
    querySnapshot.forEach((docSnap) => {
        // We inject the Firestore document ID into the row data so we can edit/delete it later.
        packages.push({
            id: docSnap.id,
            ...docSnap.data(),
        } as Row);
    });

    // Helper to safely parse dates that might be DD-MM-YYYY
    const parseSafeDate = (dateStr: string) => {
        if (!dateStr) return 0;
        let time = new Date(dateStr).getTime();
        if (isNaN(time)) {
            const parts = dateStr.split("-");
            if (parts.length === 3) {
                time = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
            }
        }
        return isNaN(time) ? 0 : time;
    };

    // Sort by Date Published descending (newest first)
    packages.sort((a, b) => {
        const dateA = String(a["Date Published"] || a["date_published"] || "");
        const dateB = String(b["Date Published"] || b["date_published"] || "");
        return parseSafeDate(dateB) - parseSafeDate(dateA);
    });

    return packages;
}

/**
 * Fetch a single package by its ID
 */
export async function getPackage(id: string): Promise<Row | null> {
    const docRef = doc(db, PACKAGES_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return {
            id: docSnap.id,
            ...docSnap.data()
        } as Row;
    } else {
        return null;
    }
}

/**
 * Add a new package to Firestore
 */
export async function addPackage(data: Omit<Row, "id">): Promise<string> {
    // Clean data (e.g., remove undefined values that Firestore rejects)
    const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    cleanedData.updatedAt = new Date().toISOString();

    const docRef = await addDoc(collection(db, PACKAGES_COLLECTION), cleanedData);
    return docRef.id;
}

/**
 * Update an existing package
 */
export async function updatePackage(id: string, data: Partial<Row>): Promise<void> {
    const docRef = doc(db, PACKAGES_COLLECTION, id);

    // Remove the 'id' from the update payload if it exists
    const updateData = { ...data };
    delete updateData.id;

    const cleanedData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined)
    );
    cleanedData.updatedAt = new Date().toISOString();

    await updateDoc(docRef, cleanedData);
}

/**
 * Delete a package from Firestore
 */
export async function deletePackage(id: string): Promise<void> {
    const docRef = doc(db, PACKAGES_COLLECTION, id);
    await deleteDoc(docRef);
}

// ─── Seasonal Offers ─────────────────────────────────────────────────────
export interface SeasonalOffer {
    id?: string;
    name: string;
    category: string; // e.g. "Spa", "Buffet", "Weekend Getaway", "Happy Hour"
    postType?: "single" | "group";
    description?: string;
    validityPeriod?: string;
    price?: string;
    originalPrice?: string;
    datePublished?: string;
    imageUrl?: string;
    imageUrls?: string[];
    isBoosted?: boolean;
    // Social stats
    fbReach?: number;
    fbReactions?: number;
    fbComments?: number;
    fbShares?: number;
    fbClicks?: number;
    igReach?: number;
    igReactions?: number;
    igComments?: number;
    igShares?: number;
    igSaves?: number;
    combinedReach?: number;
    // Boost fields
    adSpend?: number;
    impressions?: number;
    conversations?: number;
    [key: string]: string | number | boolean | string[] | undefined;
}

export async function getOffers(): Promise<SeasonalOffer[]> {
    const q = query(collection(db, OFFERS_COLLECTION), orderBy("datePublished", "desc"));
    try {
        const querySnapshot = await getDocs(q);
        const offers: SeasonalOffer[] = [];
        querySnapshot.forEach((docSnap) => {
            offers.push({ id: docSnap.id, ...docSnap.data() } as SeasonalOffer);
        });
        return offers;
    } catch {
        // Fallback without ordering if index not built yet
        const querySnapshot = await getDocs(collection(db, OFFERS_COLLECTION));
        const offers: SeasonalOffer[] = [];
        querySnapshot.forEach((docSnap) => {
            offers.push({ id: docSnap.id, ...docSnap.data() } as SeasonalOffer);
        });
        return offers.sort((a, b) => {
            const da = a.datePublished || "";
            const db2 = b.datePublished || "";
            return da < db2 ? 1 : da > db2 ? -1 : 0;
        });
    }
}

export async function addOffer(data: Omit<SeasonalOffer, "id">): Promise<string> {
    const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined && v !== "" && !Number.isNaN(v))
    );
    cleanedData.updatedAt = new Date().toISOString();
    const docRef = await addDoc(collection(db, OFFERS_COLLECTION), cleanedData);
    return docRef.id;
}

export async function updateOffer(id: string, data: Partial<SeasonalOffer>): Promise<void> {
    const docRef = doc(db, OFFERS_COLLECTION, id);
    const updateData = { ...data };
    delete updateData.id;
    const cleanedData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined && v !== "" && !Number.isNaN(v))
    );
    cleanedData.updatedAt = new Date().toISOString();
    await updateDoc(docRef, cleanedData);
}

export async function deleteOffer(id: string): Promise<void> {
    const docRef = doc(db, OFFERS_COLLECTION, id);
    await deleteDoc(docRef);
}

// ─── Audit Logging ────────────────────────────────────────────────────────
export async function logAccess(email: string, action: string): Promise<void> {
    await addDoc(collection(db, LOGS_COLLECTION), {
        email,
        action,
        timestamp: new Date().toISOString()
    });
}

export async function getLogs(): Promise<AuditLog[]> {
    const q = query(collection(db, LOGS_COLLECTION), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);

    const logs: AuditLog[] = [];
    querySnapshot.forEach((docSnap) => {
        logs.push({
            id: docSnap.id,
            ...docSnap.data()
        } as AuditLog);
    });

    return logs;
}
