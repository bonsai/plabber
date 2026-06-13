import nodemailer from "nodemailer";
import type { EntryRow } from "../db";

export type GmailConfig = {
  to: string;
  subject?: string;
  limit?: number;
  onlyNew?: boolean;
};

function buildSubject(config: GmailConfig): string {
  const date = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  return config.subject ?? `Plabber Digest ${date}`;
}

function buildHtml(entries: EntryRow[], added: number): string {
  const rows = entries
    .map(
      (e) => `
    <tr>
      <td style="padding:8px 4px;border-bottom:1px solid #27272a">
        <a href="${esc(e.url)}" style="color:#34d399;text-decoration:none;font-weight:500">${esc(e.title)}</a>
        <br>
        <span style="font-size:12px;color:#71717a">${e.company ? esc(e.company) + " · " : ""}${esc(e.published)}</span>
      </td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="background:#09090b;color:#e4e4e7;font-family:system-ui,sans-serif;padding:24px;max-width:600px;margin:0 auto">
  <h2 style="font-size:18px;margin:0 0 4px">Plabber Digest</h2>
  <p style="font-size:13px;color:#71717a;margin:0 0 20px">+${added} new &middot; ${entries.length} total</p>
  <table style="width:100%;border-collapse:collapse">
    ${rows}
  </table>
  <p style="font-size:11px;color:#52525b;margin-top:20px">
    Powered by <a href="https://github.com" style="color:#52525b">plabber</a>
  </p>
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function publishGmail(
  config: GmailConfig,
  entries: EntryRow[],
  added: number
): Promise<void> {
  if ((config.onlyNew ?? true) && added === 0) return;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;
  if (!user || !pass) {
    throw new Error("Publish::Gmail requires GMAIL_USER and GMAIL_PASS env vars");
  }

  const limit = config.limit ?? 50;
  const slice = entries.slice(0, limit);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `Plabber <${user}>`,
    to: config.to,
    subject: buildSubject(config),
    html: buildHtml(slice, added),
  });
}
