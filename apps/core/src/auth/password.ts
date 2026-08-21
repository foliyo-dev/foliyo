import bcrypt from "bcryptjs";

const ROUNDS = 12;

/** Precomputed hash so missing-user logins still pay bcrypt cost. */
const DUMMY_HASH = bcrypt.hashSync("foliyo-timing-dummy", ROUNDS);

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, ROUNDS);
}

export function checkPassword(hash: string, plain: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

/** Always runs bcrypt (dummy hash when the account is missing). */
export function checkPasswordTimed(hash: string | null | undefined, plain: string): boolean {
  return checkPassword(hash || DUMMY_HASH, plain);
}
