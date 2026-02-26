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

// The name of our Firestore collection
const PACKAGES_COLLECTION = "packages";

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
        // We'll map the `id` field from Firestore to an optional id property if needed, 
        // or just keep it in the object.
        packages.push({
            id: docSnap.id,
            ...docSnap.data(),
        } as Row);
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
