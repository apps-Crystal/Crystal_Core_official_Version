/**
 * Password hashing — Node runtime only.
 *
 * Kept separate from `./auth.ts` so the Edge middleware never bundles bcrypt.
 * Anything that calls these functions (signup, login routes) runs on Node.
 */

import bcrypt from "bcryptjs";

const BCRYPT_COST = Number(process.env.BCRYPT_COST || 12);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  try {
    return await bcrypt.compare(password, stored);
  } catch {
    return false;
  }
}
