# YSL Price Cache Worker

A Cloudflare Worker that provides cached cryptocurrency price data and token registry for the YSL Portfolio Tracker.

## Architecture

### Storage Layers

| Storage | Purpose | Write Frequency |
|---------|---------|-----------------|
| **KV** | Hot cache for real-time access | Every 5 minutes |
| **R2** | Cold storage for historical snapshots | Daily at 09:00 UTC |

### KV Keys (Hot Cache)

| Key | Description |
|-----|-------------|
| `prices:top500:latest` | Current normalized price data blob |
| `prices:top500:status` | Status with `updatedAt`, `lastSuccess`, `r2Enabled` |
| `registry:coingecko:latest` | Mirror of CoinGecko registry for fast reads |

### R2 Paths (Historical Snapshots)

| Path | Description |
|------|-------------|
| `prices/top500/YYYY-MM-DD.json` | Daily price snapshots |
| `registry/coingecko_registry.json` | Master append-only registry (source of truth) |
| `registry/top500_snapshot/YYYY-MM-DD.json` | Daily top 500 composition |

### KV Write Budget (Free Tier: 1,000 writes/day)

| Operation | Writes | Frequency | Daily Total |
|-----------|--------|-----------|-------------|
| Price refresh | 2 (latest + status) | Every 5 min (288×) | 576 |
| Registry mirror | 1 | Daily (1×) | 1 |
| **Total** | | | **~577** ✅ |

Well under the 1,000 free tier limit!

## Cron Schedules

| Cron | Schedule | Action |
|------|----------|--------|
| `*/5 * * * *` | Every 5 minutes | Refresh prices from CryptoRates.ai → KV |
| `0 9 * * *` | Daily 09:00 UTC | Write snapshot to R2, refresh registry |

## HTTP Endpoints

| Endpoint | Description | Cache |
|----------|-------------|-------|
| `GET /prices/top500.json` | Current prices from KV | 60s |
| `GET /prices/status.json` | Cache status | no-cache |
| `GET /registry/latest.json` | Token registry (KV → R2 fallback) | 1h |
| `GET /snapshots/prices/top500/YYYY-MM-DD.json` | Historical snapshot from R2 | 24h |
| `GET /health` | Health check with R2/KV status | - |
| `GET /admin/refresh-prices` | Manual price refresh | - |
| `GET /admin/refresh-registry` | Manual registry refresh | - |
| `GET /admin/write-snapshot` | Manual snapshot write | - |

## Setup Instructions

### 1. Prerequisites

```bash
# Install dependencies
cd workers/price-cache
npm install

# Login to Cloudflare
npx wrangler login
```

### 2. Create KV Namespace (if not already created)

```bash
npx wrangler kv:namespace create PRICE_KV
# Copy the ID and update wrangler.toml
```

### 3. Enable R2 and Create Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2 Object Storage
2. Enable R2 for your account (requires payment method on file)
3. Create bucket named `ysl-price-snapshots`
4. Uncomment the `[[r2_buckets]]` section in `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "PRICE_R2"
bucket_name = "ysl-price-snapshots"
```

### 4. Deploy

```bash
# Deploy to Cloudflare
npm run deploy
# or
npx wrangler deploy

# Verify deployment
curl https://ysl-price-cache.robertripleyjunior.workers.dev/health
```

### 5. Initialize Data (First Time)

```bash
# Trigger initial price fetch
curl https://ysl-price-cache.robertripleyjunior.workers.dev/admin/refresh-prices

# Trigger initial registry fetch
curl https://ysl-price-cache.robertripleyjunior.workers.dev/admin/refresh-registry
```

## R2 Requirement for Daily Snapshots

R2 is **required** for daily snapshot functionality. If R2 is not configured:

- The `0 9 * * *` daily cron will **hard fail** with error
- Status will show: `"R2 disabled - daily snapshot skipped"`
- The 5-minute price refresh will continue working (KV only)
- Historical snapshots endpoint will return 503

### Verification

Check R2 status:
```bash
curl https://ysl-price-cache.robertripleyjunior.workers.dev/health
# Should show: "r2Enabled": true
```

Check status endpoint:
```bash
curl https://ysl-price-cache.robertripleyjunior.workers.dev/prices/status.json
```

## Local Development

```bash
# Start local dev server
npm run dev

# Test endpoints
curl http://localhost:8787/health
curl http://localhost:8787/admin/refresh-prices
curl http://localhost:8787/prices/top500.json
```

## Schemas

### Normalized Prices (`/prices/top500.json`)

```json
{
  "source": "cryptorates.ai",
  "updatedAt": "2026-01-28T03:10:00.000Z",
  "count": 500,
  "bySymbol": {
    "BTC": {
      "symbol": "BTC",
      "name": "Bitcoin",
      "rank": 1,
      "priceUsd": 88929.33,
      "marketCapUsd": 1778130000000,
      "volume24hUsd": 12345678,
      "change24hPct": 1.23
    }
  }
}
```

### Daily Snapshot (`/snapshots/prices/top500/YYYY-MM-DD.json`)

Same as normalized prices, plus:

```json
{
  "snapshotDate": "2026-01-28",
  "snapshotTimestamp": "2026-01-28T09:00:00.000Z",
  "source": "cryptorates.ai",
  ...
}
```

### Registry (`/registry/latest.json`)

```json
{
  "source": "coingecko",
  "updatedAt": "2026-01-28T09:00:00.000Z",
  "count": 500,
  "byId": {
    "bitcoin": {
      "id": "bitcoin",
      "symbol": "BTC",
      "name": "Bitcoin",
      "logoUrl": "https://...",
      "marketCapRank": 1,
      "firstSeenAt": "2026-01-28T09:00:00.000Z",
      "lastSeenAt": "2026-01-28T09:00:00.000Z"
    }
  },
  "symbolToIds": {
    "BTC": ["bitcoin"],
    "USDC": ["usd-coin"]
  }
}
```

### Status (`/prices/status.json`)

```json
{
  "success": true,
  "count": 499,
  "timestamp": "2026-01-28T03:10:00.000Z",
  "trigger": "scheduled",
  "lastSuccess": "2026-01-28T03:10:00.000Z",
  "r2Enabled": true,
  "service": "ysl-price-cache",
  "kvWritesPerDay": "~577 (well under 1,000 free tier limit)"
}
```

## Troubleshooting

### "R2 disabled - daily snapshot skipped"

1. Enable R2 in Cloudflare Dashboard
2. Create bucket `ysl-price-snapshots`
3. Uncomment R2 section in `wrangler.toml`
4. Deploy: `npm run deploy`

### Prices Not Updating

1. Check status: `curl .../prices/status.json`
2. If `success: false`, check the `error` field
3. Manually trigger: `curl .../admin/refresh-prices`

### KV updatedAt Not Advancing

1. Check cron is running in Cloudflare Dashboard → Workers → ysl-price-cache → Triggers
2. Check Worker logs for errors
3. Manually trigger price refresh

### R2 Daily File Not Appearing

1. Verify R2 is enabled: `curl .../health` should show `r2Enabled: true`
2. Check if daily cron ran (09:00 UTC)
3. Manually trigger: `curl .../admin/write-snapshot`
4. Check R2 bucket in Cloudflare Dashboard

### Registry Not Growing (Append-Only)

1. The registry is append-only - entries are never removed
2. New coins are added when they enter the top 500
3. `firstSeenAt` tracks when coin was first added
4. `lastSeenAt` tracks most recent update
