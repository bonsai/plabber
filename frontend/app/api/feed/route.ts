import { NextResponse } from "next/server";
import { scrapePRTimes } from "@/lib/scraper";

export async function GET() {
  try {
    const keywords = (process.env.PLABBER_KEYWORDS || "試食会").split(",").map((s) => s.trim());
    const industries = (process.env.PLABBER_INDUSTRIES || "レストラン,カフェ,ホテル,食品,飲食,ビストロ,バー,居酒屋").split(",").map((s) => s.trim());
    const events = await scrapePRTimes(keywords, industries);
    return NextResponse.json(events);
  } catch {
    return NextResponse.json([]);
  }
}
