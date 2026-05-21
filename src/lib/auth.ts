import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { verifyPassword } from "./password";

const COOKIE = "op_session";

function secret(): string {
  return process.env.OPERATOR_SESSION_SECRET || "dev-secret";
}

function sign(value: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(value).digest("hex");
  return `${value}.${sig}`;
}

// Returns the signed username if the token is valid, else null.
function unsign(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
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
    return null;
  }
  return value;
}

export async function loginOperator(
  username: string,
  password: string
): Promise<boolean> {
  const uname = username.trim().toLowerCase();
  if (!uname || !password) return false;
  const user = await prisma.operatorUser.findUnique({
    where: { username: uname },
  });
  if (!user || !verifyPassword(password, user.passwordHash)) return false;

  const store = await cookies();
  store.set(COOKIE, sign(user.username), {
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

// The logged-in operator's username, or null.
export async function getOperator(): Promise<string | null> {
  const store = await cookies();
  return unsign(store.get(COOKIE)?.value);
}

export async function isOperatorAuthed(): Promise<boolean> {
  return (await getOperator()) !== null;
}

export async function requireOperator(): Promise<void> {
  if (!(await isOperatorAuthed())) {
    throw new Error("Non autorisé");
  }
}
