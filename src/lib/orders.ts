import { randomInt } from "crypto";

// Unambiguous alphabet (no 0/O, 1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateOrderCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
