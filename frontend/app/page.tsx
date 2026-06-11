"use client";

import { useEffect, useState } from "react";

type Event = {
  uid: string;
  title: string;
  url: string;
  published: string;
  summary: string;
  company: string;
};

type Status = { running: boolean; lastRun: string | null; error: string | null };

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState<Status>({ running: false, lastRun: null, error: null });
  const [agentLog, setAgentLog] = useState<string[]>([]);

  const fetchFeed = async () => {
    try {
      const res = await fetch("/api/feed");
      if (res.ok) setEvents(await res.json());
    } catch {}
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/agent");
      if (res.ok) setStatus(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchFeed();
    fetchStatus();
    const interval = setInterval(fetchFeed, 30000);
    return () => clearInterval(interval);
  }, []);

  const runPipeline = async () => {
    setStatus((s) => ({ ...s, running: true, error: null }));
    setAgentLog([]);
    try {
      const res = await fetch("/api/run", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAgentLog(data.log || []);
      await fetchFeed();
      await fetchStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setStatus((s) => ({ ...s, error: msg }));
    } finally {
      setStatus((s) => ({ ...s, running: false }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plabber</h1>
          <p className="text-sm text-zinc-400">PR TIMES 飲食イベント digest</p>
        </div>
        <div className="flex items-center gap-3">
          {status.running && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              running
            </span>
          )}
          <button
            onClick={runPipeline}
            disabled={status.running}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {status.running ? "..." : "Run Pipeline"}
          </button>
        </div>
      </header>

      {status.lastRun && (
        <p className="text-xs text-zinc-500">Last run: {new Date(status.lastRun).toLocaleString("ja-JP")}</p>
      )}
      {status.error && (
        <p className="text-sm text-red-400 bg-red-950/50 rounded-lg p-3">{status.error}</p>
      )}

      {agentLog.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-4 space-y-1 font-mono text-xs max-h-48 overflow-y-auto">
          {agentLog.map((line, i) => (
            <p key={i} className={line.includes("error") ? "text-red-400" : "text-zinc-400"}>
              {line}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-semibold">Events ({events.length})</h2>
          {events.length === 0 && (
            <p className="text-zinc-500 text-sm">No events found. Run the pipeline.</p>
          )}
          {events.map((ev) => (
            <div key={ev.uid} className="bg-zinc-900 rounded-xl p-4 space-y-1">
              <a
                href={ev.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-emerald-400 hover:underline leading-snug block"
              >
                {ev.title}
              </a>
              <p className="text-xs text-zinc-500">
                {ev.company && <span className="text-zinc-400">{ev.company} · </span>}
                {ev.published && <span>{ev.published}</span>}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-900 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold">Links</h3>
            <a
              href="/api/calendar"
              className="block text-sm text-emerald-400 hover:underline"
            >
              calendar.ics
            </a>
            <a
              href="/api/feed"
              className="block text-sm text-emerald-400 hover:underline"
            >
              feed.json
            </a>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold">Subscribe</h3>
            <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Copy calendar.ics URL</li>
              <li>Google Calendar → Other calendars</li>
              <li>+ → URL → Paste → Add</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
