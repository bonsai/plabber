import { NextResponse } from "next/server";
import { scrapePRTimes, toICal } from "@/lib/scraper";

export async function GET() {
  try {
    const keywords = (process.env.PLABBER_KEYWORDS || "試食会").split(",").map((s) => s.trim());
    const industries = (process.env.PLABBER_INDUSTRIES || "レストラン,カフェ,ホテル,食品,飲食,ビストロ,バー,居酒屋").split(",").map((s) => s.trim());
    const events = await scrapePRTimes(keywords, industries);
    return new NextResponse(toICal(events), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="calendar.ics"',
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
