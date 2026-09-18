# DebridStream ⚡

A high-performance, production-grade, self-hosted Real-Debrid Stremio addon providing a seamless Torrentio-like user experience built entirely from scratch with original code and architecture.

---

## Key Features

- **Official Stremio Protocol Compliance**: Native support for Movies, TV Series, and individual Episodes (`tt...` and `tt...:season:episode`).
- **Real-Debrid Only**: Exclusively retrieves instant-availability cached releases (`[RD+]`) and resolves high-speed direct CDN streams.
- **Sub-Second Response Times**: Stream listings query batched instant availability and return lazy resolution URLs, deferring file un-restricting until playback begins.
- **Provider-Adapter Architecture**: Independent, isolated adapters for YTS, EZTV, ThePirateBay, and TorrentGalaxy.
- **Circuit Breakers & Resilience**: Request timeouts (3.5s), failover policies, and circuit breakers ensure broken or slow providers never stall Stremio.
- **Multi-Level Caching**:
  - `L1`: Fast in-memory LRU cache.
  - `L2`: Redis or automatic embedded persistent file cache.
  - `L3`: Provider search results cache (2 hours TTL).
  - `L4`: Real-Debrid instant availability (30 min TTL) and resolved stream links (4 hours TTL).
- **Stream Ranking Engine**: Deterministic scoring based on resolution (4K > 1080p > 720p), source (Remux > BluRay > WEB-DL), audio (Atmos/TrueHD), HDR/DV, and seeders.
- **Deduplication Engine**: Eliminates duplicate torrents across providers using infoHash and audio/video release fingerprints.
- **Security First**: Real-Debrid tokens are encrypted in addon configuration URLs and strictly redacted from all logs, URLs, and errors.
- **Modern Configuration Web UI**: Responsive dark-mode dashboard at `/configure` with live token validation and one-click Stremio installation.
- **Docker Ready**: Production-grade multi-stage `Dockerfile` and `docker-compose.yml`.

---

## Quick Start with Docker

```bash
# Clone or navigate to the repository
git clone <your-repo> debrid-stream
cd debrid-stream

# Copy and configure environment variables
cp .env.example .env

# Launch with docker-compose
docker compose up -d
```

Once running:
1. Open `http://localhost:7000/configure` in your browser.
2. Enter your Real-Debrid API Key (from [real-debrid.com/apitoken](https://real-debrid.com/apitoken)).
3. Customize your resolution and provider preferences.
4. Click **Install Addon to Stremio**.

---

## Manual / Local Development

### Prerequisites
- Node.js 20+ (Node 24 recommended)
- npm

### Installation & Run
```bash
npm install

# Run in watch mode for development
npm run dev

# Run automated tests
npm test

# Build for production
npm run build
npm start
```

---

## Addon Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/configure` | GET | Addon configuration web UI |
| `/health` | GET | Healthcheck and live provider metrics |
| `/manifest.json` | GET | Default unconfigured Stremio manifest |
| `/:config/manifest.json` | GET | User-configured Stremio manifest |
| `/:config/stream/:type/:id.json` | GET | Stream list handler for movies and episodes |
| `/resolve/:config/:infoHash/:fileIdx` | GET | Resolves torrent to direct RD HTTP stream (302 redirect) |
| `/api/validate-token` | POST | Validates Real-Debrid API token |
| `/api/encode-config` | POST | Encrypts user configuration into manifest URL |

---

## License

MIT
