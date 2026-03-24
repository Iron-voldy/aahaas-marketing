import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import bcrypt from "bcryptjs";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import type { SessionUser } from "@/lib/session";

export async function POST(request: Request) {
    try {
        const { name, email, password } = await request.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: "All fields are required" }, { status: 400 });
        }

        if (password.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
        }

        const pool = getMysqlPool();

        // Check if email already exists
        const [existing] = await pool.query(
            "SELECT id FROM app_users WHERE email = ?",
            [email]
        );
        const existingUsers = existing as { id: number }[];
        if (existingUsers.length > 0) {
            return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
        }

        // Hash password & insert
        const password_hash = await bcrypt.hash(password, 12);
        const [result] = await pool.query(
            "INSERT INTO app_users (name, email, password_hash) VALUES (?, ?, ?)",
            [name, email, password_hash]
        );
        const insertResult = result as { insertId: number };

        // Log the registration
        try {
            await pool.query(
                "INSERT INTO app_logs (email, action) VALUES (?, ?)",
                [email, "New user registered."]
            );
        } catch { /* non-fatal */ }

        // Auto-login after registration
        const sessionUser: SessionUser = { id: insertResult.insertId, email, name };
        const token = createSessionToken(sessionUser);

        const response = NextResponse.json({ user: sessionUser }, { status: 201 });
        response.cookies.set(SESSION_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60,
            path: "/",
        });
        return response;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[auth/register]", message);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
