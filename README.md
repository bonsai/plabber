# plabber — Plagger in Bun/TypeScript

> **Plagger + Bun = CDN-edge RSS pipeline. Zero Docker.**

Plabber is a full rewrite of [Plagger](https://github.com/plagger/plagger) from Perl to TypeScript, running on [Bun](https://bun.sh).
Target deploy target: **Cloudflare Workers** (or any WinterCG runtime).

Reference impl: [bonsai/event-crawler](https://github.com/bonsai/event-crawler)

## Why

|              | Plagger (Perl/Docker) | plabber (Bun/TS)                |
| ------------ | --------------------- | ------------------------------- |
| Startup      | ~5s                   | ~50ms (Bun) / <1ms (Workers)    |
| Memory       | ~100MB                | ~20MB (Bun) / ~5MB (Workers)    |
| Deploy       | Docker only           | `npx wrangler deploy`           |
| Runtime cost | VPS ~$5/mo           | Workers free tier (100k req/day)|
| Language     | Perl (動的)          | TypeScript (静的型)             |

**1000+ feeds on $0/mo. No containers.**

## Bounty

**1000 TTOKEN** to first implementation that passes the test suite.

## Pipeline

```
subscription (feed URL) → [filter ...] → publish (output)
```

```
plabber run -c config.yaml
plabber serve --port 8080       # HTTP mode (local)
wrangler deploy                  # → Workers
```

## Plugin interface

```typescript
interface Subscription {
  name: string
  feeds(): Promise<Feed[]>
}

interface Filter {
  name: string
  filter(ctx: Context, entry: Entry): Promise<Entry | null>
}

interface Publish {
  name: string
  publish(ctx: Context, entry: Entry): Promise<void>
}
```

### Built-in plugins

| Module               | Description                          |
| -------------------- | ------------------------------------ |
| Subscription::Config | Static feed list from YAML           |
| Subscription::OPML   | OPML file import                     |
| Filter::Deduped      | GUID dedup (Map/KV)                  |
| Filter::Rule         | Title/content regex match            |
| Filter::Truncate     | Trim body length                     |
| Publish::GAS         | POST to Google Apps Script Web App   |
| Publish::Stdout      | Print to stdout                      |
| Publish::Webhook     | Generic HTTP POST                    |
| Publish::WorkersKV   | Write to Workers KV (built-in)       |

## Config (YAML)

Same shape as Plagger:

```yaml
global:
  timezone: Asia/Tokyo

plugins:
  - module: Subscription::Config
    config:
      feed:
        - url: https://example.com/feed.xml
  - module: Filter::Deduped
  - module: Filter::Rule
    config:
      - match:
          title: Tech|Startup
  - module: Publish::Stdout
```

## API mode (local)

```bash
plabber serve --port 8080 --config config.yaml
```

| Method | Path             | Description                |
| ------ | ---------------- | -------------------------- |
| POST   | /run             | Execute pipeline once      |
| GET    | /plugins         | List loaded plugins        |
| GET    | /health          | Health check               |

## Cloudflare Workers deploy

```bash
npx wrangler init plabber --yes
# copy src/ to the project
npx wrangler deploy
```

Add cron trigger in `wrangler.toml`:

```toml
name = "plabber"
main = "src/index.ts"

[triggers]
crons = ["*/15 * * * *"]
```

## Project structure

```
plabber/
├── cmd/
│   └── plabber.ts        # CLI entrypoint (Bun)
├── src/
│   ├── index.ts           # Workers entrypoint
│   ├── feed.ts            # RSS/Atom fetch + parse
│   ├── filter.ts          # Filter implementations
│   ├── publish.ts         # Publisher implementations
│   ├── plugin.ts          # Plugin registry
│   ├── config.ts          # YAML config loader
│   └── storage.ts         # Dedup state (Map/KV)
├── package.json
├── tsconfig.json
├── wrangler.toml
└── README.md
```

## Getting started (once implemented)

```bash
bun create plabber my-feeds && cd my-feeds
# edit config.yaml
bun run plabber run -c config.yaml

# deploy to Workers
npx wrangler deploy
```

## Milestones

1. **Core**: feed fetch → filter chain → publish (CLI + Workers mode) — **300 TTOKEN**
2. **Dedup**: Workers KV-backed dedup — **100 TTOKEN**
3. **API**: `serve` command with /run endpoint — **200 TTOKEN**
4. **GAS publish**: POST to Google Apps Script Web App — **100 TTOKEN**
5. **OPML import**: Subscription::OPML — **100 TTOKEN**
6. **Cron trigger**: Built-in cron scheduler for Workers — **200 TTOKEN**

Total: **1000 TTOKEN**

## License

MIT
