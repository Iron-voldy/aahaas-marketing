/**
 * lib/session.ts
 *
 * Cookie-based session management (no Firebase, no external JWT library).
 * Signs and verifies a session cookie using HMAC-SHA256 with a server secret.
 */

import crypto from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "aahaas_session";
const SECRET = process.env.SESSION_SECRET || "aahaas-dev-secret-change-in-prod";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionUser {
    id: number;
    email: string;
    name: string;
}

// ── Signing ─────────────────────────────────────────────────────────────────

function hmac(payload: string): string {
    return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** Create a signed token:  base64url(JSON) + "." + HMAC */
export function createSessionToken(user: SessionUser): string {
    const payload = Buffer.from(
        JSON.stringify({ ...user, exp: Date.now() + MAX_AGE_MS })
    ).toString("base64url");
    return `${payload}.${hmac(payload)}`;
}

/** Verify the token and return the SessionUser if valid, else null */
export function verifySessionToken(token: string): SessionUser | null {
    try {
        const dot = token.lastIndexOf(".");
        if (dot < 0) return null;
        const payload = token.slice(0, dot);
        const sig     = token.slice(dot + 1);
        if (hmac(payload) !== sig) return null;

        const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
        if (data.exp < Date.now()) return null;

        return { id: data.id, email: data.email, name: data.name };
    } catch {
        return null;
    }
}

// ── Server-side helpers (Next.js App Router) ────────────────────────────────

/** Read and verify the session cookie from the current request. */
export async function getSessionUser(): Promise<SessionUser | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return verifySessionToken(token);
}
