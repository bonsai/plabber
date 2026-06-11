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

const SOURCES = [
  { id: "prtimes", label: "PR TIMES", color: "bg-red-600", status: "active" },
  { id: "doorkeeper", label: "Doorkeeper", color: "bg-blue-600", status: "planned" },
  { id: "partiful", label: "Partiful", color: "bg-pink-500", status: "planned" },
  { id: "techplay", label: "TECH PLAY", color: "bg-teal-600", status: "planned" },
  { id: "peatix", label: "Peatix", color: "bg-orange-500", status: "planned" },
  { id: "kokuchipro", label: "こくちーずプロ", color: "bg-green-600", status: "planned" },
  { id: "eventhub", label: "EventHub", color: "bg-purple-600", status: "planned" },
];

const FILTERS = [
  { id: "yotei", label: "日付フィルタ", status: "active" },
  { id: "keyword", label: "キーワードフィルタ", status: "active" },
  { id: "llm", label: "LLM分類 (Sakura)", status: "planned" },
];

const OUTPUTS = [
  { id: "ical", label: "iCal (.ics)", status: "active" },
  { id: "json", label: "JSON (.json)", status: "active" },
  { id: "csv", label: "CSV (.csv)", status: "active" },
];

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState<Status>({ running: false, lastRun: null, error: null });
  const [agentLog, setAgentLog] = useState<string[]>([]);
  const [keywords, setKeywords] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>(["prtimes"]);

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
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: selectedSources, keywords }),
      });
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

  const toggleSource = (id: string) => {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plabber</h1>
          <p className="text-sm text-zinc-400">イベントフィードパイプライン</p>
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
            {status.running ? "..." : "▶ Run"}
          </button>
        </div>
      </header>

      {status.lastRun && (
        <p className="text-xs text-zinc-500">
          Last run: {new Date(status.lastRun).toLocaleString("ja-JP")}
        </p>
      )}
      {status.error && (
        <p className="text-sm text-red-400 bg-red-950/50 rounded-lg p-3">{status.error}</p>
      )}

      {/* pipeline visual */}
      <div className="bg-zinc-900 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">Pipeline</h2>

        {/* source selector */}
        <div>
          <p className="text-xs text-zinc-500 mb-2">Source</p>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleSource(s.id)}
                disabled={s.status === "planned"}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  selectedSources.includes(s.id)
                    ? "bg-emerald-900/50 text-emerald-300 ring-1 ring-emerald-700"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                } ${s.status === "planned" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span className={`w-2 h-2 rounded-full ${s.color}`} />
                {s.label}
                {s.status === "planned" && (
                  <span className="text-[10px] text-zinc-500 ml-1">soon</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* filters */}
        <div>
          <p className="text-xs text-zinc-500 mb-2">Filter</p>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <span
                key={f.id}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  f.status === "active"
                    ? "bg-zinc-800 text-zinc-300"
                    : "bg-zinc-800/50 text-zinc-600"
                }`}
              >
                {f.label}
                {f.status === "planned" && (
                  <span className="text-[10px] text-zinc-600 ml-1">soon</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* outputs */}
        <div>
          <p className="text-xs text-zinc-500 mb-2">Output</p>
          <div className="flex flex-wrap gap-2">
            {OUTPUTS.map((o) => (
              <span
                key={o.id}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300"
              >
                {o.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* keywords */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <label className="text-xs text-zinc-500 mb-2 block">Keywords</label>
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="試食会, 勉強会, 交流会, ..."
          className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-emerald-700"
        />
      </div>

      {/* agent log */}
      {agentLog.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-4 space-y-1 font-mono text-xs max-h-48 overflow-y-auto">
          {agentLog.map((line, i) => (
            <p
              key={i}
              className={line.includes("error") ? "text-red-400" : "text-zinc-400"}
            >
              {line}
            </p>
          ))}
        </div>
      )}

      {/* events + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-semibold">Events ({events.length})</h2>
          {events.length === 0 && (
            <p className="text-zinc-500 text-sm">No events found.</p>
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
          <div className="bg-zinc-900 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold">Planned Sources</h3>
            <p className="text-xs text-zinc-500">
              Doorkeeper, Partiful, TECH PLAY, Peatix, こくちーずプロ, EventHub
              — スクレイパー実装 pending
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
