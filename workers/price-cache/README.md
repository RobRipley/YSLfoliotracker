# YSL Price Cache Worker

A Cloudflare Worker that provides cached cryptocurrency price data and a token registry for the YSL Portfolio Tracker.

## Features

- **Price Caching**: Fetches top 500 coins from CryptoRates.ai every 5 minutes
- **Daily Snapshots**: Stores versioned price snapshots in R2 storage
- **Token Registry**: Maintains a CoinGecko-based registry with logos and stable IDs
- **Fast Reads**: Serves cached data from KV storage with minimal latency

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CRON JOBS                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Every 5 minutes:                                          │
│  └── Fetch cryptorates.ai/v1/coins/500                     │
│  └── Normalize and store in KV                             │
│                                                             │
│  Daily at 09:00 UTC:                                       │
│  └── Write price snapshot to R2                            │
│  └── Fetch CoinGecko /coins/markets (2 pages)              │
│  └── Merge into append-only registry                       │
│  └── Write registry to R2 and KV                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    HTTP ENDPOINTS                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GET /prices/top500.json                                    │
│  └── Returns normalized price data for top 500 coins       │
│  └── Cache-Control: public, max-age=60                     │
│                                                             │
│  GET /prices/status.json                                    │
│  └── Returns price refresh status and metadata             │
│                                                             │
│  GET /registry/latest.json                                  │
│  └── Returns token registry with logos and IDs             │
│  └── Cache-Control: public, max-age=3600                   │
│                                                             │
│  GET /health                                                │
│  └── Health check endpoint                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Setup

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers enabled
- Wrangler CLI installed globally (`npm install -g wrangler`)

### Installation

1. Navigate to the worker directory:
   ```bash
   cd workers/price-cache
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Login to Cloudflare:
   ```bash
   wrangler login
   ```

### Create Cloudflare Resources

1. **Create KV Namespace:**
   ```bash
   wrangler kv:namespace create PRICE_KV
   # Copy the ID and update wrangler.toml
   ```

2. **Create R2 Bucket:**
   ```bash
   wrangler r2 bucket create ysl-price-snapshots
   ```

3. **Update wrangler.toml** with the KV namespace ID:
   ```toml
   [[kv_namespaces]]
   binding = "PRICE_KV"
   id = "<YOUR_KV_NAMESPACE_ID>"
   ```

### Local Development

Run the worker locally:
```bash
npm run dev
```

This starts a local server at `http://localhost:8787`.

Test endpoints:
```bash
# Health check
curl http://localhost:8787/health

# Prices (may be empty until cron runs)
curl http://localhost:8787/prices/top500.json

# Status
curl http://localhost:8787/prices/status.json

# Registry
curl http://localhost:8787/registry/latest.json
```

### Deployment

Deploy to Cloudflare:
```bash
npm run deploy
```

The worker will be available at:
`https://ysl-price-cache.<your-subdomain>.workers.dev`

## Response Schemas

### Prices Response (`/prices/top500.json`)

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
      "priceUsd": 88162.45,
      "marketCapUsd": 1750000000000,
      "volume24hUsd": 25000000000,
      "change24hPct": 2.5
    },
    "ETH": { ... },
    ...
  }
}
```

### Registry Response (`/registry/latest.json`)

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
      "logoUrl": "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
      "marketCapRank": 1,
      "firstSeenAt": "2026-01-28T09:00:00.000Z",
      "lastSeenAt": "2026-01-28T09:00:00.000Z"
    },
    ...
  },
  "symbolToIds": {
    "BTC": ["bitcoin"],
    "USDC": ["usd-coin", "bridged-usdc-polygon-pos-bridge"],
    ...
  }
}
```

### Status Response (`/prices/status.json`)

```json
{
  "success": true,
  "count": 500,
  "timestamp": "2026-01-28T03:10:00.000Z",
  "trigger": "scheduled",
  "updatedAt": "2026-01-28T03:10:00.000Z",
  "service": "ysl-price-cache"
}
```

## Attribution

Prices are sourced from [CryptoRates.ai](https://cryptorates.ai) - attribution is required in the frontend:

> Prices powered by cryptorates.ai

## Troubleshooting

### Prices not updating

1. Check the status endpoint: `/prices/status.json`
2. View logs: `wrangler tail`
3. Verify KV namespace is properly configured
4. Check CryptoRates.ai API availability

### Registry empty

1. The registry is populated daily at 09:00 UTC
2. Trigger manually via Wrangler dashboard or wait for scheduled job
3. Check for CoinGecko API rate limiting

### R2 snapshots not appearing

1. Verify R2 bucket exists: `wrangler r2 bucket list`
2. Check bucket name matches wrangler.toml
3. Review worker logs for errors

## License

MIT
