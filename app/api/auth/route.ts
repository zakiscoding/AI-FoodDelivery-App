import { NextResponse } from "next/server";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { supabase as anonClient } from "../../lib/supabase";
import { getSupabaseServiceClient } from "../../lib/supabaseService";

function getDb() {
  // Auth must read/write password hashes and create profiles; prefer service role
  // so RLS does not block signup/login. Fall back to anon for local demos.
  return getSupabaseServiceClient() ?? anonClient;
}

function isBcryptHash(hash: string) {
  return hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$");
}

async function verifyPassword(password: string, passwordHash: string) {
  if (isBcryptHash(passwordHash)) {
    return bcrypt.compare(password, passwordHash);
  }

  // Legacy seed script used SHA-256 hex digests
  const legacyHash = createHash("sha256").update(password).digest("hex");
  return legacyHash === passwordHash;
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: string;
    email?: string;
    password?: string;
    name?: string;
    role?: string;
  };
  const { action, password, name, role } = body;
  const email = body.email?.trim().toLowerCase();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400 }
    );
  }

  const supabase = getDb();

  if (action === "signup") {
    if (!name || !role || !["customer", "driver"].includes(role)) {
      return NextResponse.json(
        { error: "Name and valid role (customer/driver) required" },
        { status: 400 }
      );
    }

    try {
      const { data: user, error: userError } = await supabase
        .from("users")
        .insert({
          email,
          password_hash: await bcrypt.hash(password, 12),
          name: name.trim(),
          role,
        })
        .select()
        .single();

      if (userError) {
        if (userError.code === "23505") {
          return NextResponse.json(
            { error: "An account with this email already exists" },
            { status: 409 }
          );
        }
        throw userError;
      }

      if (role === "customer") {
        const { error: customerError } = await supabase.from("customers").insert({
          user_id: user.id,
        });
        if (customerError) throw customerError;
      } else if (role === "driver") {
        const { error: driverError } = await supabase.from("drivers").insert({
          user_id: user.id,
        });
        if (driverError) throw driverError;
      }

      const { password_hash, ...safeUser } = user;
      void password_hash;
      return NextResponse.json({ user: safeUser, success: true }, { status: 201 });
    } catch (err) {
      console.error("Signup error:", err);
      return NextResponse.json({ error: "Signup failed" }, { status: 500 });
    }
  } else if (action === "login") {
    try {
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (userError || !user) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      const validPassword = await verifyPassword(password, user.password_hash);
      if (!validPassword) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      // Upgrade legacy SHA-256 hashes to bcrypt after a successful login
      if (!isBcryptHash(user.password_hash)) {
        const upgradedHash = await bcrypt.hash(password, 12);
        await supabase
          .from("users")
          .update({ password_hash: upgradedHash })
          .eq("id", user.id);
      }

      const { password_hash, ...safeUser } = user;
      void password_hash;
      return NextResponse.json({ user: safeUser, success: true });
    } catch (err) {
      console.error("Login error:", err);
      return NextResponse.json({ error: "Login failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
