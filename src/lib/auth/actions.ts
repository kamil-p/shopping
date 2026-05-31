"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { users } from "@/db/schema";

import { credentialsSchema, normalizeEmail } from "./credentials";
import { hashPassword, verifyPassword } from "./password";
import {
  createSession,
  deleteSessionCookie,
  getSessionToken,
  invalidateSession,
  setSessionCookie,
} from "./session";

export type LoginState = { error?: string };

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const email = normalizeEmail(parsed.data.email);
  const { password } = parsed.data;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!user) {
    // Spend comparable time to avoid leaking which emails exist.
    await hashPassword(password);
    return { error: "Invalid email or password" };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  redirect("/");
}

export async function logout(): Promise<void> {
  const token = await getSessionToken();
  if (token) {
    await invalidateSession(token);
  }
  await deleteSessionCookie();
  redirect("/login");
}
