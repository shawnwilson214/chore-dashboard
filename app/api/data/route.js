import { Redis } from "@upstash/redis";

// Vercel's Marketplace Redis integration (Upstash) injects one of these
// env var pairs automatically once you connect a database to the project.
const url =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

const KEY = "chore-dashboard-data";

// Don't cache these responses — every load/save must hit fresh data.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!redis) {
    return Response.json(
      { error: "Redis is not configured. Add a database from the Vercel Storage tab." },
      { status: 500 }
    );
  }
  const data = await redis.get(KEY);
  return Response.json(data ?? null);
}

export async function POST(request) {
  if (!redis) {
    return Response.json(
      { error: "Redis is not configured. Add a database from the Vercel Storage tab." },
      { status: 500 }
    );
  }
  const body = await request.json();
  await redis.set(KEY, body);
  return Response.json({ ok: true });
}
