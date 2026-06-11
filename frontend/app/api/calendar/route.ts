import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET() {
  try {
    const path = join(process.cwd(), "..", "docs", "calendar.ics");
    const data = await readFile(path, "utf-8");
    return new NextResponse(data, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="calendar.ics"',
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
