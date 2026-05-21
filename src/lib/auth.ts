import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "op_session";
const SUBJECT = "operator";

function secret(): string {
  return process.env.OPERATOR_SESSION_SECRET || "dev-secret";
}

function sign(value: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(value).digest("hex");
  return `${value}.${sig}`;
}

function verify(token: string | undefined): boolean {
  if (!token) return false;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return false;
  const value = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto
    .createHmac("sha256", secret())
    .update(value)
    .digest("hex");
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return false;
  }
  return value === SUBJECT;
}

export async function isOperatorAuthed(): Promise<boolean> {
  const store = await cookies();
  return verify(store.get(COOKIE)?.value);
}

export async function loginOperator(password: string): Promise<boolean> {
  const expected = process.env.OPERATOR_PASSWORD || "";
  if (!expected || password !== expected) return false;
  const store = await cookies();
  store.set(COOKIE, sign(SUBJECT), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return true;
}

export async function logoutOperator(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function requireOperator(): Promise<void> {
  if (!(await isOperatorAuthed())) {
    throw new Error("Non autorisé");
  }
}
