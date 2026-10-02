import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  const ids = await kv.lrange("plans", 0, -1);
  if (!ids || ids.length === 0) {
    return NextResponse.json({ history: [] });
  }

  const history = await Promise.all(
    ids.map(async (id) => {
      const plan = await kv.get(`plan:${id}`);
      if (!plan) return null;
      const votesEntries = await Promise.all(
        plan.steps.map(async (s) => [s.id, (await kv.hgetall(`votes:${id}:${s.id}`)) || {}])
      );
      return { plan, votes: Object.fromEntries(votesEntries) };
    })
  );

  return NextResponse.json({ history: history.filter(Boolean) });
}
