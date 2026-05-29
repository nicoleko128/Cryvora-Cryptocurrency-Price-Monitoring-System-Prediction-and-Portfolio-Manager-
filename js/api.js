/**
 * api.js
 * Market data  → Coinlore (free, no key, open CORS)
 * Chart / OHLC → Binance public klines (free, no key)
 *
 * Caching strategy (two layers):
 *   1. In-memory cache with stale-while-revalidate (React Query pattern):
 *      - Returns stale data instantly; refreshes in background.
 *   2. localStorage "Redis" cache:
 *      - Persists data across page reloads with TTL-based expiry.
 *      - Acts as a warm-start so the first render is always instant.
 */
const API = (() => {
    const CL     = 'https://api.coinlore.net/api';
    const LS_PFX = 'cryvora::qc::';

    // ── localStorage "Redis" layer ────────────────────────────────────────────
    const LS = {
        set(key, data, ttl) {
            try {
                localStorage.setItem(LS_PFX + key, JSON.stringify({ data, exp: Date.now() + ttl }));
            } catch (_) {}
        },
        get(key) {
            try {
                const raw = localStorage.getItem(LS_PFX + key);
                if (!raw) return null;
                const { data, exp } = JSON.parse(raw);
                if (Date.now() > exp) { localStorage.removeItem(LS_PFX + key); return null; }
                return data;
            } catch (_) { return null; }
        },
        evictExpired() {
            try {
                const now = Date.now();
                const dead = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (!k?.startsWith(LS_PFX)) continue;
                    try {
                        const { exp } = JSON.parse(localStorage.getItem(k));
                        if (now > exp) dead.push(k);
                    } catch (_) { dead.push(k); }
                }
                dead.forEach(k => localStorage.removeItem(k));
            } catch (_) {}
        },
    };

    // Evict stale entries on load (keep storage clean, like Redis TTL expiry)
    setTimeout(LS.evictExpired, 2000);

    // ── In-memory React-Query-style cache ─────────────────────────────────────
    // Entry: { data, ts, staleTime, cacheTime, pending? }
    const memCache  = new Map();
    const pendingMap = new Map();

    function getTTL(url) {
        if (url.includes('fng'))                           return { staleTime: 600_000, cacheTime: 24 * 3_600_000 };
        if (url.includes('klines'))                        return { staleTime:  90_000, cacheTime:    600_000 };
        if (url.includes('tickers') || url.includes('global')) return { staleTime:  60_000, cacheTime:    300_000 };
        return { staleTime: 60_000, cacheTime: 180_000 };
    }

    // Pre-hydrate memory cache from localStorage so first renders are instant
    ;(function hydrate() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k?.startsWith(LS_PFX)) continue;
                const raw = localStorage.getItem(k);
                if (!raw) continue;
                const { data, exp } = JSON.parse(raw);
                if (!data || Date.now() > exp) continue;
                const url = k.slice(LS_PFX.length);
                const { staleTime, cacheTime } = getTTL(url);
                // Mark as stale so background refresh fires on first access
                memCache.set(url, { data, ts: Date.now() - staleTime, staleTime, cacheTime });
            }
        } catch (_) {}
    })();

    async function rqFetch(url, fetcher) {
        const now = Date.now();
        const entry = memCache.get(url);
        const { staleTime, cacheTime } = getTTL(url);

        if (entry) {
            const age = now - entry.ts;

            // Fresh → serve immediately, no network call
            if (age < staleTime) return entry.data;

            // Stale but within cacheTime → serve stale data + revalidate in background
            if (age < cacheTime) {
                if (!entry.pending) {
                    entry.pending = true;
                    _doFetch(url, fetcher, staleTime, cacheTime).catch(() => {
                        const e = memCache.get(url);
                        if (e) e.pending = false;
                    });
                }
                return entry.data;
            }
        }

        // Expired or uncached → must wait for fresh data
        return _doFetch(url, fetcher, staleTime, cacheTime);
    }

    async function _doFetch(url, fetcher, staleTime, cacheTime) {
        // Deduplicate concurrent requests for the same URL
        if (pendingMap.has(url)) return pendingMap.get(url);

        const promise = (async () => {
            try {
                const data = await fetcher();
                const entry = { data, ts: Date.now(), staleTime, cacheTime, pending: false };
                memCache.set(url, entry);
                LS.set(url, data, cacheTime);
                return data;
            } finally {
                pendingMap.delete(url);
                const e = memCache.get(url);
                if (e) e.pending = false;
            }
        })();

        pendingMap.set(url, promise);
        return promise;
    }

    // ── Network helpers ───────────────────────────────────────────────────────
    function timedFetch(url, ms = 8000) {
        const ctrl = new AbortController();
        const id   = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
    }

    const proxyUrl = u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`;

    async function safeFetch(url) {
        const attempt = u => timedFetch(u, 5000).then(r => {
            if (r.ok) return r.json();
            return Promise.reject(new Error(`HTTP ${r.status}`));
        });
        try { return await attempt(url); } catch (_) {}
        try { return await attempt(proxyUrl(url)); } catch {
            throw new Error('Cannot reach market data API. Check your internet connection.');
        }
    }

    // ── Coin ID mappings ──────────────────────────────────────────────────────
    const TO_CL = {
        'binancecoin': 'binance-coin', 'ripple': 'xrp', 'avalanche-2': 'avalanche',
        'near': 'near-protocol', 'toncoin': 'toncoin', 'matic-network': 'matic',
        'curve-dao-token': 'curve', 'sei-network': 'sei', 'axie-infinity': 'axie-infinity',
        'the-sandbox': 'the-sandbox', 'lido-dao': 'lido-dao', 'render-token': 'render',
        'decentraland': 'decentraland', 'internet-computer': 'icp', 'worldcoin-wld': 'worldcoin',
        'mantle': 'mantle',
    };
    const TO_APP = Object.fromEntries(Object.entries(TO_CL).map(([a, c]) => [c, a]));

    const BINANCE = {
        'bitcoin':'BTCUSDT','ethereum':'ETHUSDT','binancecoin':'BNBUSDT','solana':'SOLUSDT',
        'ripple':'XRPUSDT','cardano':'ADAUSDT','dogecoin':'DOGEUSDT','polkadot':'DOTUSDT',
        'avalanche-2':'AVAXUSDT','chainlink':'LINKUSDT','litecoin':'LTCUSDT','uniswap':'UNIUSDT',
        'stellar':'XLMUSDT','cosmos':'ATOMUSDT','near':'NEARUSDT','bitcoin-cash':'BCHUSDT',
        'ethereum-classic':'ETCUSDT','tron':'TRXUSDT','shiba-inu':'SHIBUSDT',
        'hedera-hashgraph':'HBARUSDT','filecoin':'FILUSDT','aptos':'APTUSDT',
        'vechain':'VETUSDT','algorand':'ALGOUSDT','injective-protocol':'INJUSDT',
        'render-token':'RNDRUSDT','matic-network':'MATICUSDT','the-graph':'GRTUSDT',
        'fetch-ai':'FETUSDT','toncoin':'TONUSDT','arbitrum':'ARBUSDT','optimism':'OPUSDT',
        'fantom':'FTMUSDT','aave':'AAVEUSDT','maker':'MKRUSDT','the-sandbox':'SANDUSDT',
        'decentraland':'MANAUSDT','axie-infinity':'AXSUSDT','stacks':'STXUSDT',
        'lido-dao':'LDOUSDT','curve-dao-token':'CRVUSDT','sui':'SUIUSDT',
        'sei-network':'SEIUSDT','internet-computer':'ICPUSDT','pepe':'PEPEUSDT',
        'worldcoin-wld':'WLDUSDT','mantle':'MNTUSDT',
    };

    const icon = sym => `https://assets.coincap.io/assets/icons/${sym.toLowerCase()}@2x.png`;

    // ── Coinlore helpers ──────────────────────────────────────────────────────
    async function clTickers() {
        const url = `${CL}/tickers/?start=0&limit=100`;
        const raw = await rqFetch(url, () => safeFetch(url));
        return Array.isArray(raw) ? raw : (raw.data || []);
    }

    async function clFind(appId) {
        const list   = await clTickers();
        const clName = TO_CL[appId] || appId;
        return list.find(c => c.nameid === clName)
            || list.find(c => c.symbol.toLowerCase() === appId.replace('coin','').replace(/-\d/,'').toLowerCase());
    }

    function mapTicker(c) {
        const appId = TO_APP[c.nameid] || c.nameid;
        return {
            id:                                   appId,
            symbol:                               c.symbol.toLowerCase(),
            name:                                 c.name,
            image:                                icon(c.symbol),
            current_price:                        parseFloat(c.price_usd)          || 0,
            market_cap:                           parseFloat(c.market_cap_usd)     || 0,
            total_volume:                         parseFloat(c.volume24)           || 0,
            price_change_percentage_24h:          parseFloat(c.percent_change_24h)  || 0,
            price_change_percentage_7d_in_currency: parseFloat(c.percent_change_7d) || 0,
            rank:                                 parseInt(c.rank),
        };
    }

    // ── Binance klines ────────────────────────────────────────────────────────
    async function binanceKlines(coinId, interval, limit, symHint) {
        const sym = BINANCE[coinId] || (symHint ? `${symHint.toUpperCase()}USDT` : null);
        if (!sym) return null;
        const url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`;

        return rqFetch(url, async () => {
            const r = await timedFetch(url, 5000);
            if (!r.ok) throw new Error(`Binance HTTP ${r.status}`);
            const d = await r.json();
            if (!Array.isArray(d) || !d.length) throw new Error('Empty klines');
            return d;
        }).catch(() => null);
    }

    // ── Fake history fallback ─────────────────────────────────────────────────
    function fakeHistory(price, days) {
        const pts = []; const now = Date.now();
        let p = price * (0.88 + Math.random() * 0.1);
        const baseVol  = price * 50000;
        const useDaily = days > 30;
        const count    = useDaily ? days : days * 24;
        const stepMs   = useDaily ? 86_400_000 : 3_600_000;
        for (let i = count; i >= 0; i--) {
            p = Math.max(0.0001, p * (1 + (Math.random() - 0.485) * 0.018));
            pts.push([now - i * stepMs, p, baseVol * (0.5 + Math.random() * 1.5)]);
        }
        pts[pts.length - 1][1] = price;
        return pts;
    }

    // ═══════════════════════════════ Public API ═══════════════════════════════
    return {

        // Global market stats
        getGlobal: async () => {
            const url = `${CL}/global/`;
            const raw = await rqFetch(url, () => safeFetch(url));
            const g   = Array.isArray(raw) ? raw[0] : raw;
            return {
                data: {
                    total_market_cap:      { usd: parseFloat(g.total_mcap)   || 0 },
                    total_volume:          { usd: parseFloat(g.total_volume) || 0 },
                    market_cap_percentage: { btc: parseFloat(g.btc_d)        || 40 },
                    active_cryptocurrencies: parseInt(g.coins_count)         || 20000,
                },
            };
        },

        // Top coins list
        getMarkets: async (page = 1, perPage = 100) => {
            const start = (page - 1) * perPage;
            const url   = `${CL}/tickers/?start=${start}&limit=${perPage}`;
            const raw   = await rqFetch(url, () => safeFetch(url));
            const list  = Array.isArray(raw) ? raw : (raw.data || []);
            return list.map(mapTicker);
        },

        // Historical prices + volume (Binance → fake fallback)
        getMarketChart: async (id, days, symHint) => {
            const iv = days <= 1 ? '1h' : days <= 7 ? '4h' : '1d';
            const lm = days <= 1 ? 24  : days <= 7 ? 42  : Math.min(days, 365);
            const kl = await binanceKlines(id, iv, lm, symHint);
            if (kl) return {
                prices:        kl.map(k => [k[0], parseFloat(k[4])]),
                total_volumes: kl.map(k => [k[0], parseFloat(k[7])]),
            };
            try {
                const c   = await clFind(id);
                const pts = fakeHistory(parseFloat(c?.price_usd) || 100, days);
                return { prices: pts.map(p => [p[0], p[1]]), total_volumes: pts.map(p => [p[0], p[2]]) };
            } catch (_) { return { prices: [], total_volumes: [] }; }
        },

        // OHLC candles
        getOHLC: async (id, days, symHint) => {
            const iv = days <= 1 ? '1h' : days <= 7 ? '4h' : '1d';
            const lm = days <= 1 ? 24  : days <= 7 ? 42  : Math.min(days, 365);
            const kl = await binanceKlines(id, iv, lm, symHint);
            if (kl) {
                if (iv === '1d') return kl.map(k => [k[0], +k[1], +k[2], +k[3], +k[4]]);
                const bucketMs = iv === '1h' ? 4 * 3_600_000 : 86_400_000;
                const groups   = new Map();
                kl.forEach(k => {
                    const key = Math.floor(k[0] / bucketMs) * bucketMs;
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(k);
                });
                return [...groups.entries()].sort(([a], [b]) => a - b).map(([ts, g]) => [
                    ts, +g[0][1], Math.max(...g.map(c => +c[2])), Math.min(...g.map(c => +c[3])), +g[g.length - 1][4],
                ]);
            }
            try {
                const c   = await clFind(id);
                const pts = fakeHistory(parseFloat(c?.price_usd) || 100, Math.min(days, 365));
                const map = new Map();
                const DAY = 86_400_000;
                pts.forEach(([ts, p]) => {
                    const k = Math.floor(ts / DAY) * DAY;
                    map.has(k) ? map.get(k).push(p) : map.set(k, [p]);
                });
                return [...map.entries()].sort((a, b) => a[0] - b[0])
                    .map(([ts, ps]) => {
                        const mid  = ps[0];
                        const body = mid * (0.005 + Math.random() * 0.02);
                        const wick = mid * (0.003 + Math.random() * 0.008);
                        const isUp = Math.random() > 0.5;
                        const o = isUp ? mid - body * 0.5 : mid + body * 0.5;
                        const c = isUp ? mid + body * 0.5 : mid - body * 0.5;
                        return [ts, o, Math.max(o, c) + wick, Math.min(o, c) - wick, c];
                    });
            } catch (_) { return []; }
        },

        // Coin detail
        getCoinDetail: async (id) => {
            const c = await clFind(id);
            if (!c) throw new Error(`Coin not found: ${id}`);
            return {
                name:   c.name,
                symbol: c.symbol.toLowerCase(),
                image:  { small: icon(c.symbol) },
                market_data: {
                    current_price:               { usd: parseFloat(c.price_usd)          || 0 },
                    price_change_percentage_24h:  parseFloat(c.percent_change_24h)        || 0,
                    market_cap:                  { usd: parseFloat(c.market_cap_usd)     || 0 },
                    total_volume:                { usd: parseFloat(c.volume24)           || 0 },
                    high_24h: { usd: null }, low_24h: { usd: null },
                    ath: { usd: null }, circulating_supply: parseFloat(c.csupply) || 0,
                },
            };
        },

        // Search
        searchCoins: async (query) => {
            try {
                const q    = query.toLowerCase();
                const list = await clTickers();
                const hits = list.filter(c =>
                    c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q) || c.nameid.toLowerCase().includes(q)
                ).slice(0, 10);
                return { coins: hits.map(c => ({ id: TO_APP[c.nameid] || c.nameid, name: c.name, symbol: c.symbol })) };
            } catch (_) { return { coins: [] }; }
        },

        // Simple prices (from cached tickers — zero extra requests)
        getSimplePrice: async (ids) => {
            const result = {};
            try {
                const list = await clTickers();
                ids.forEach(id => {
                    const clName = TO_CL[id] || id;
                    const c = list.find(t => t.nameid === clName)
                        || list.find(t => t.symbol.toLowerCase() === id.replace('coin','').replace(/-\d/,'').toLowerCase());
                    if (c) result[id] = {
                        usd:            parseFloat(c.price_usd)          || 0,
                        usd_24h_change: parseFloat(c.percent_change_24h) || 0,
                    };
                });
            } catch (_) {}
            return result;
        },

        // WebSocket helpers
        getWsSymbol:   (coinId, symHint) => BINANCE[coinId] || (symHint ? `${symHint.toUpperCase()}USDT` : null),
        getWsInterval: (days)   => days <= 1 ? '1h' : days <= 7 ? '4h' : days <= 30 ? '1d' : days <= 90 ? '3d' : '1w',

        // Fear & Greed
        getFearGreed: async (limit = 1) => {
            const url = `https://api.alternative.me/fng/?limit=${limit}`;
            try {
                return await rqFetch(url, async () => {
                    const r = await timedFetch(url, 8000);
                    if (r.ok) return r.json();
                    throw new Error(`FnG HTTP ${r.status}`);
                });
            } catch (_) {
                return { data: Array.from({ length: limit }, (_, i) => ({
                    value: '50', value_classification: 'Neutral',
                    timestamp: String(Math.floor((Date.now() - i * 86400000) / 1000)),
                })) };
            }
        },
    };
})();
