const CONNPASS_API = "https://connpass.com/api/v1/event/";

type ConnpassEvent = {
  event_id: number;
  title: string;
  catch: string;
  description: string;
  event_url: string;
  started_at: string;
  ended_at: string;
  place: string;
  address: string;
  limit: number | null;
  accepted: number;
  waiting: number;
  updated_at: string;
  owner_id: number;
  owner_nickname: string;
  owner_display_name: string;
  series?: {
    id: number;
    title: string;
    url: string;
  };
};

type ConnpassResponse = {
  results_returned: number;
  results_available: number;
  results_start: number;
  events: ConnpassEvent[];
};

type FeedItem = {
  uid: string;
  title: string;
  url: string;
  published: string;
  summary: string;
  place: string;
};

type FeedResult = {
  title: string;
  link: string;
  entries: FeedItem[];
};

export default async function main(): Promise<FeedResult> {
  const params = new URLSearchParams({
    keyword: "Ruby",
    count: "100",
    order: "2",
  });

  const url = `${CONNPASS_API}?${params}`;
  const res = await fetch(url, {
    headers: { "user-agent": "plabber/0.1" },
  });

  if (!res.ok) {
    throw new Error(`connpass API error: ${res.status}`);
  }

  const data = (await res.json()) as ConnpassResponse;

  const tokyoEvents = data.events.filter((ev) => {
    const location = (ev.place ?? "") + (ev.address ?? "");
    return location.includes("東京") || location.includes("Tokyo");
  });

  const entries: FeedItem[] = tokyoEvents.map((ev) => ({
    uid: String(ev.event_id),
    title: ev.title,
    url: ev.event_url,
    published: ev.started_at.slice(0, 10),
    summary: ev.catch || ev.description?.replace(/<[^>]+>/g, "").slice(0, 200) || "",
    place: ev.place || ev.address || "",
  }));

  return {
    title: "connpass Ruby 東京イベント",
    link: "https://connpass.com/",
    entries,
  };
}

if (import.meta.main) {
  const result = await main();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
