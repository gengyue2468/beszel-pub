# beszel-pub

A lightweight public status page for [Beszel](https://github.com/henrygd/beszel).

Beszel ships a full authenticated dashboard, but not a read-only page you can expose on the internet. This app fills that gap: it pulls metrics from your Beszel hub and renders a simple, shareable server status board.

Live example: [st.gy.run](https://st.gy.run)

## Features

- CPU, RAM, disk I/O, and network charts with live rates
- Disk usage, uptime, cumulative upload/download
- Sort by name, CPU, RAM, disk, uptime, or status
- Auto-refresh every 5 seconds
- Light/dark mode via system preference
- Sensitive fields (host, port) are never shown

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

## Development

```bash
npm install
npm run dev
```

In development, Vite proxies `/beszel` to `BESZEL_URL`. Server-side loaders call that proxy path instead of hitting the hub directly, which also works when the hub is only reachable over a private network (e.g. Tailscale).

## Production

```bash
npm run build
npm run start
```

Or use the included Dockerfile:

```bash
docker build -t beszel-pub .
docker run --env-file .env -p 3000:3000 beszel-pub
```

In production, the `/beszel/*` route forwards requests to `BESZEL_URL` the same way the Vite proxy does in dev.

## Stack

React Router 7 (SSR), Tailwind CSS v4, Recharts, Beszel PocketBase API.