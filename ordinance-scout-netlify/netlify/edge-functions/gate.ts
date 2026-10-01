// Password gate in front of EVERY page and API call. Only the login page and login call are public.
// The session cookie is signed with SESSION_SECRET by netlify/lib/auth.mjs; here we just verify the signature.
import type { Config, Context } from "@netlify/edge-functions";

const PUBLIC = [/^\/login(\.html)?$/, /^\/api\/login$/, /^\/favicon\.ico$/, /^\/login-brand\.svg$/];
const enc = new TextEncoder();

function b64urlDecode(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return atob(s);
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function valid(token: string): Promise<boolean> {
  try {
    const secret = Deno.env.get("SESSION_SECRET") || "";
    if (!secret || !token) return false;
    const raw = b64urlDecode(token);
    const dot = raw.indexOf(".");
    if (dot < 0) return false;
    const exp = raw.slice(0, dot), sig = raw.slice(dot + 1);
    if (!/^\d+$/.test(exp) || Date.now() > Number(exp)) return false;
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(exp)));
    const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
    return same(sig, hex);
  } catch {
    return false;
  }
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  if (PUBLIC.some((r) => r.test(url.pathname))) return context.next();

  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)oi_session=([^;]+)/);
  if (m && (await valid(m[1]))) {
    const res = await context.next();
    res.headers.set("cache-control", "private, no-store");
    return res;
  }
  if (url.pathname.startsWith("/api/")) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  const next = encodeURIComponent(url.pathname + url.search);
  return Response.redirect(new URL(`/login?next=${next}`, url), 302);
};

// Functions under /.netlify/ enforce the same session check themselves (and accept the internal key for scheduled jobs).
export const config: Config = { path: "/*", excludedPath: ["/.netlify/*"] };
