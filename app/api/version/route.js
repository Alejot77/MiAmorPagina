import { NextResponse } from "next/server";
import build from "@/lib/version.json";

export const dynamic = "force-dynamic";

// GET -> version publicada ahora mismo. La app instalada la compara con la
// version con la que se abrio para ofrecer reiniciar despues de un despliegue.
export function GET() {
  return NextResponse.json({ version: build.version }, { headers: { "Cache-Control": "no-store" } });
}
