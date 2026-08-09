import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/env";
import { SESSION_MAX_AGE_SECONDS } from "./constants";

function getSecretKey() {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}
