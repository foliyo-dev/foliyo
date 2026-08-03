import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, ROUNDS);
}

export function checkPassword(hash: string, plain: string): boolean {
  return bcrypt.compareSync(plain, hash);
}
