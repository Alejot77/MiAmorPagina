import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  const ids = await kv.lrange("polls", 0, -1);
  if (!ids || ids.length === 0) {
    return NextResponse.json({ history: [] });
  }

  const history = await Promise.all(
    ids.map(async (id) => {
      const poll = await kv.get(`poll:${id}`);
      const votes = (await kv.hgetall(`votes:${id}`)) || {};
      return { poll, votes };
    })
  );

  return NextResponse.json({ history: history.filter((h) => h.poll) });
}
