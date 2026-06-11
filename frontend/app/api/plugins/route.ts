import { NextResponse } from "next/server";

export async function GET() {
  const plugins = [
    { module: "CustomFeed::Script", type: "source", description: "Bun/Node script as feed source" },
    { module: "Publish::ICal", type: "output", description: "Generate iCal (.ics) file" },
    { module: "Publish::JSON", type: "output", description: "Generate JSON feed file" },
    { module: "Publish::CSV", type: "output", description: "Write rows to CSV" },
    { module: "Transform::LLM", type: "filter", description: "LLM text transform" },
    { module: "Enrich::SakuraGenre", type: "filter", description: "Sakura genre classification" },
  ];
  return NextResponse.json(plugins);
}
