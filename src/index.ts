import { runPipeline } from "./pipeline";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/run") {
      try {
        const body = await request.json().catch(() => ({})) as { config?: string };
        const configPath = body.config || "config.yaml";
        const result = await runPipeline(configPath);
        return new Response(JSON.stringify(result), {
          headers: { "content-type": "application/json" },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    return new Response("not found", { status: 404 });
  },

  async scheduled(_event: ScheduledEvent): Promise<void> {
    await runPipeline("config.yaml");
  },
};
