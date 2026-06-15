# beszel-pub

A lightweight public status page for [Beszel](https://github.com/henrygd/beszel).

Beszel ships a full authenticated dashboard, but not a read-only page you can expose on the internet. This app fills that gap: it pulls metrics from your Beszel hub and renders a simple, shareable server status board.

Live example: [st.gy.run](https://st.gy.run)

## Features

- CPU, RAM, disk I/O, and network charts with live rates
- Disk usage, uptime, cumulative upload/download
- Grid and list layouts, sortable by name, CPU, RAM, disk, uptime, or status
- Live updates over Server-Sent Events (SSE)
- Light/dark mode via system preference
- Sensitive fields (host, port) are never shown

## How it works

- The **server** talks to your Beszel hub (`BESZEL_URL`) with PocketBase auth and subscribes to PocketBase Realtime (`systems`, `system_stats`, per-system `rt_metrics`).
- Static machine info (CPU model, OS, kernel, arch) is loaded once from the `system_details` collection on page load.
- The **browser** opens `EventSource("/api/systems/stream")` and receives coalesced dashboard snapshots; no polling.

## Configuration

Site branding and UI copy live in `app/config.ts`. Beszel credentials stay in environment variables.

```env
BESZEL_URL=https://your-beszel-hub.example
BESZEL_EMAIL=your-email
BESZEL_PASSWORD=your-password

# or use a token instead of email/password
# BESZEL_TOKEN=
```

Copy `.env.example` to `.env` and fill in your values.

The app reads `.env` from the process working directory at startup (`app/lib/env.server.ts`). `react-router-serve` does not load `.env` by itself, so PM2 `cwd` must point at the project root (or inject the variables another way).

## Development

```bash
npm install
npm run dev
```

The dev server calls Beszel directly using `BESZEL_URL`. The hub only needs to be reachable from the machine running this app (Tailscale, LAN, etc.).

## Production

```bash
npm run build
npm run start
```

Default listen port is **3000** (`react-router-serve`).

Or use the included Dockerfile:

```bash
docker build -t beszel-pub .
docker run --env-file .env -p 3000:3000 beszel-pub
```

### PM2

1. Build on the server (or deploy the `build/` output plus `package.json` / lockfile).
2. Copy `ecosystem.config.example.cjs` to `ecosystem.config.cjs` and set `cwd` to the project root.
3. Ensure `.env` exists in that directory (or set `env` / `env_file` in the PM2 config).

```bash
npm run build
cp ecosystem.config.example.cjs ecosystem.config.cjs
# edit ecosystem.config.cjs — set cwd to your deploy path

pm2 start ecosystem.config.cjs
pm2 save
pm2 logs beszel-pub
```

Example `ecosystem.config.cjs`:

```js
module.exports = {
  apps: [
    {
      name: "beszel-pub",
      cwd: "/path/to/beszel-pub",
      script: "npm",
      args: "run start",
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
```

**Important:** if `cwd` is wrong, `.env` is not found and the dashboard will fail with a configuration or auth error. Run only **one instance** — the in-memory realtime cache is not shared across processes.

After code or env changes:

```bash
npm run build
pm2 restart beszel-pub
```

### Reverse proxy (Caddy / Nginx)

The status page relies on a long-lived SSE connection at `/api/systems/stream`. Reverse proxies must **disable response buffering** and use **long read timeouts**, otherwise updates can stall or appear frozen.

The app already sends `X-Accel-Buffering: no` on the stream response.

#### Caddy

```caddy
st.example.com {
    reverse_proxy 127.0.0.1:3000 {
        flush_interval -1
        transport http {
            read_timeout 0
            write_timeout 0
        }
    }
}
```

- `flush_interval -1` — stream chunks to the client immediately (needed for SSE).
- `read_timeout 0` / `write_timeout 0` — no idle timeout on the upstream connection.

#### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name st.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE / long polling
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        chunked_transfer_encoding on;
    }
}
```

You can scope stricter settings only to the stream route:

```nginx
location /api/systems/stream {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

If SSE still buffers, check CDN / WAF layers in front of the proxy as well.

## Stack

React Router 7 (SSR), Tailwind CSS v4, Recharts, Beszel PocketBase API, PocketBase Realtime.
