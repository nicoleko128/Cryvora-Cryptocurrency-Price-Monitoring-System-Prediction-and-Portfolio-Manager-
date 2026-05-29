# Cryvora — Cryptocurrency Price Monitoring System

A browser-based, single-page cryptocurrency monitoring and analysis platform built entirely with client-side web technologies. No backend server, no API keys, no installation required — open `index.html` and it runs.

---

## Features

### Dashboard
- Live global market stats — total market cap, 24h trading volume, BTC dominance, active cryptocurrencies
- Scrolling price ticker showing the top 25 cryptocurrencies with live price and 24h change, refreshing every 60 seconds
- Bitcoin and Ethereum spotlight cards with live price, 24h/7d change, market cap, and volume
- Market Sentiment Analysis gauge — composite score (0–100) from 5 weighted factors: price movement, 7-day trend, volume activity, Fear & Greed Index, and BTC dominance
- Top Gainers and Top Losers tables (last 24 hours)
- Top 50 cryptocurrencies table — click any row to open a coin detail modal

### Market Page
- Live market heatmap — treemap grid of top 50 coins, sized by market cap, coloured by 24h performance
- Market Pulse — advancing vs declining count, average 24h change, total volume across top 100 assets
- Coin Screener — filter by category (Layer 1, Layer 2, DeFi, Gaming, Meme) and sort by any metric

### Charts Page
- Line and candlestick chart via TradingView Lightweight Charts
- 5 timeframes: 1 Day, 1 Week, 1 Month, 3 Months, 1 Year
- 6 technical indicators: SMA 20, SMA 50, EMA 12, EMA 26, Bollinger Bands, VWAP
- Sub-charts: Volume, RSI (14), MACD with signal line and histogram
- Drawing tools: trend lines, arrows, horizontal/vertical lines, rectangles, text labels — anchored to chart coordinates so they survive scroll and zoom
- Live green dot indicator showing active Binance WebSocket connection

### Prediction Page
- OLS Linear Regression model built from scratch in JavaScript (no ML libraries)
- Configurable forecast horizon (1–30 days) and training window (30–180 days)
- Chart shows historical prices, fitted regression line, and projected future prices
- Stats panel: current vs predicted price, expected % change, trend direction, R² fit quality
- Smart recommendation engine combining regression output with RSI and MACD to produce a BUY / SELL / HOLD signal with confidence percentage and bullet-point reasoning

### Portfolio
- Add holdings by coin, quantity, buy price, and purchase date
- Live P&L calculation — current value, amount invested, profit/loss in USD and %, overall ROI
- Asset allocation donut chart
- Best and worst performing positions highlighted
- Data persisted to `localStorage` — survives browser restarts

### Watchlist
- Pin favourite coins and monitor live prices and 24h changes in one place

### Compare
- Select 2–3 coins and compare side-by-side summary cards and a normalised 7-day performance line chart

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 |
| Styling | CSS3, Bootstrap 5.3.2, Bootstrap Icons 1.11.3 |
| Scripting | JavaScript ES6+ (Vanilla, no frameworks) |
| Charts | TradingView Lightweight Charts, ApexCharts |
| Fonts | Inter, Orbitron, JetBrains Mono, Oxanium (Google Fonts) |
| Real-time | Binance WebSocket API (`wss://stream.binance.com`) |
| Storage | `localStorage` (portfolio, watchlist, cache) |

---

## Data Sources

| Source | Data | Auth |
|--------|------|------|
| [Coinlore API](https://www.coinlore.com/cryptocurrency-data-api) | Market prices, market cap, volume, global stats | None |
| [Binance Public API](https://binance-docs.github.io/apidocs/) | Historical OHLCV klines | None |
| Binance WebSocket Stream | Live kline and miniTicker updates | None |
| [Alternative.me Fear & Greed Index](https://alternative.me/crypto/fear-and-greed-index/) | Market sentiment value | None |

No API keys are required for any data source.

---

## Project Structure

```
├── index.html              # Single-page app shell — all page sections loaded here
├── css/
│   └── style.css           # All styles including dark/light themes and responsive layout
└── js/
    ├── api.js              # Data layer — Coinlore + Binance REST, two-layer caching
    ├── ws.js               # Binance WebSocket manager with RAF throttling and auto-reconnect
    ├── app.js              # Main application logic — page rendering and navigation
    ├── charts.js           # TradingView chart setup, indicators overlay, drawing tools
    ├── indicators.js       # Technical analysis — SMA, EMA, RSI, MACD, Bollinger Bands
    ├── prediction.js       # OLS linear regression engine
    ├── recommendation.js   # BUY/SELL/HOLD signal generator
    ├── portfolio.js        # Portfolio CRUD and P&L calculations
    ├── watchlist.js        # Watchlist management
    ├── theme.js            # Dark/light mode toggle
    └── custom-select.js    # Custom coin dropdown component
```

---

## Caching Architecture

`api.js` implements a two-layer cache with no external dependencies:

**Layer 1 — In-memory (stale-while-revalidate)**
Returns stale data immediately while refreshing in the background — same pattern as React Query. Deduplicates concurrent requests for the same URL.

**Layer 2 — `localStorage` (warm-start persistence)**
Survives page reloads. Acts like a Redis TTL cache — expired entries are evicted on startup. Pre-hydrates the memory cache on load so the first render is always instant.

| Data type | Stale time | Cache time |
|-----------|-----------|------------|
| Market tickers / global stats | 60 s | 5 min |
| Binance klines | 90 s | 10 min |
| Fear & Greed Index | 10 min | 24 h |

---

## Usage

1. Clone or download the repository
2. Open `index.html` in any modern browser
3. An internet connection is required to fetch live market data

No build step, no package manager, no server needed.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` or `Ctrl+K` | Focus the search bar |

---

## Author

Ko Shan Si


## Price Prediction are for educational purposes only
