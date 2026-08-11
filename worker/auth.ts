const SESSION_COOKIE = "club_planner_session";
const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_ITERATIONS = 120_000;
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePassword(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return [
    "pbkdf2-sha256",
    String(PASSWORD_ITERATIONS),
    toBase64Url(salt),
    toBase64Url(hash),
  ].join("$");
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterationValue, saltValue, hashValue] = encoded.split("$");
  const iterations = Number(iterationValue);
  if (
    algorithm !== "pbkdf2-sha256" ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    !saltValue ||
    !hashValue
  ) {
    return false;
  }
  try {
    const actual = await derivePassword(
      password,
      fromBase64Url(saltValue),
      iterations,
    );
    return constantTimeEqual(actual, fromBase64Url(hashValue));
  } catch {
    return false;
  }
}

export function createSessionToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return toBase64Url(new Uint8Array(digest));
}

export function readSessionToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === SESSION_COOKIE) return valueParts.join("=") || null;
  }
  return null;
}

export function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_LIFETIME_SECONDS}${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function sessionExpiry() {
  return new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000).toISOString();
}
