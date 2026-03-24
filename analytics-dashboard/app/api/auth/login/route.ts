import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import bcrypt from "bcryptjs";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import type { SessionUser } from "@/lib/session";

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
        }

        const pool = getMysqlPool();
        const [rows] = await pool.query(
            "SELECT id, email, name, password_hash FROM app_users WHERE email = ?",
            [email]
        );
        const users = rows as { id: number; email: string; name: string; password_hash: string }[];

        if (users.length === 0) {
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
        }

        const user = users[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
        }

        const sessionUser: SessionUser = { id: user.id, email: user.email, name: user.name || user.email };
        const token = createSessionToken(sessionUser);

        // Log the login
        try {
            await pool.query(
                "INSERT INTO app_logs (email, action) VALUES (?, ?)",
                [user.email, "User logged into the admin dashboard."]
            );
        } catch { /* non-fatal */ }

        const response = NextResponse.json({ user: sessionUser });
        response.cookies.set(SESSION_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: "/",
        });
        return response;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[auth/login]", message);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
