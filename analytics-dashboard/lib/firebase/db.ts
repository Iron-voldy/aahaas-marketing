import { db, auth } from "./config";
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
import { signInAnonymously } from "firebase/auth";
import type { Row } from "@/lib/types";

// The name of our Firestore collections
const PACKAGES_COLLECTION = "packages";
const OFFERS_COLLECTION = "seasonal_offers";
const LOGS_COLLECTION = "audit_logs";

/** Ensure a Firebase Auth session exists before reading Firestore.
 *  Tries anonymous sign-in if not authenticated (requires Anonymous Auth
 *  to be enabled in the Firebase console). Silently succeeds or fails. */
let _authEnsured = false;
async function ensureFirebaseAuth(): Promise<void> {
    if (_authEnsured || auth.currentUser) { _authEnsured = true; return; }
    try {
        await signInAnonymously(auth);
        _authEnsured = true;
    } catch {
        // Anonymous auth not enabled — caller will see Firestore permission error
    }
}

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
    await ensureFirebaseAuth();
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
export async function addPackage(data: Omit<Row, "id">, entryDate?: string): Promise<string> {
    await ensureFirebaseAuth();
    // Clean data (e.g., remove undefined values that Firestore rejects)
    const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    cleanedData.updatedAt = new Date().toISOString();

    // If entryDate is provided, initialize history
    if (entryDate) {
        const historyDate = entryDate.split("T")[0]; // Ensure YYYY-MM-DD
        const metrics: Record<string, string | number> = {};
        Object.entries(cleanedData).forEach(([k, v]) => {
            if (typeof v === "number" || (typeof v === "string" && !k.includes("Date") && k !== "Package" && k !== "Destination")) {
                metrics[k] = v as string | number;
            }
        });
        cleanedData.history = { [historyDate]: metrics };
    }

    const docRef = await addDoc(collection(db, PACKAGES_COLLECTION), cleanedData);
    return docRef.id;
}

/**
 * Update an existing package
 */
export async function updatePackage(id: string, data: Partial<Row>, entryDate?: string): Promise<void> {
    await ensureFirebaseAuth();
    const docRef = doc(db, PACKAGES_COLLECTION, id);

    // Get current document to merge history
    let existingHistory: Record<string, any> = {};
    if (entryDate) {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            existingHistory = snap.data().history || {};
        }
    }

    // Remove the 'id' from the update payload if it exists
    const updateData = { ...data };
    delete updateData.id;

    const cleanedData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined)
    );
    cleanedData.updatedAt = new Date().toISOString();

    // Update history for the specific entry date
    if (entryDate) {
        const historyDate = entryDate.split("T")[0];
        const metrics: Record<string, string | number> = {};
        
        // Use either provided data (for updates) or existing fields
        // Since updatePackage might only receive partial data, we should be careful.
        // For a true "daily snapshot", we want the current state of numeric metrics.
        Object.entries(cleanedData).forEach(([k, v]) => {
            if (typeof v === "number") {
                metrics[k] = v;
            }
        });

        // Merge with existing history
        cleanedData.history = {
            ...existingHistory,
            [historyDate]: {
                ...(existingHistory[historyDate] || {}),
                ...metrics
            }
        };
    }

    await updateDoc(docRef, cleanedData);
}

/**
 * Delete a package from Firestore
 */
export async function deletePackage(id: string): Promise<void> {
    await ensureFirebaseAuth();
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
    // Inquiries and Bookings
    inquiries?: number;
    inquiriesFb?: number;
    inquiriesIg?: number;
    inquiriesWa?: number;
    inquiriesWeb?: number;
    inquiriesOther?: number;
    bookings?: number;
    [key: string]: string | number | boolean | string[] | undefined;
}

export async function getOffers(): Promise<SeasonalOffer[]> {
    await ensureFirebaseAuth();
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
    await ensureFirebaseAuth();
    const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined && v !== "" && !Number.isNaN(v))
    );
    cleanedData.updatedAt = new Date().toISOString();
    const docRef = await addDoc(collection(db, OFFERS_COLLECTION), cleanedData);
    return docRef.id;
}

export async function updateOffer(id: string, data: Partial<SeasonalOffer>): Promise<void> {
    await ensureFirebaseAuth();
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
    await ensureFirebaseAuth();
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
