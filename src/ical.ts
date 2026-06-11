export type ICalEvent = {
  uid: string;
  summary: string;
  description: string;
  url: string;
  dtstart: string;
  dtend?: string;
};

export function toICal(events: ICalEvent[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Plabber//Plabber Digest//JA",
    "X-WR-CALNAME:飲食イベント新着",
    "X-WR-TIMEZONE:Asia/Tokyo",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`SUMMARY:${escapeText(ev.summary)}`);
    lines.push(`DTSTART;VALUE=DATE:${ev.dtstart.replace(/-/g, "")}`);
    lines.push(`DTEND;VALUE=DATE:${(ev.dtend || ev.dtstart).replace(/-/g, "")}`);
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    }
    if (ev.url) {
      lines.push(`URL:${ev.url}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
