/**
 * app.js – Cryvora main application controller
 * Wires together all modules: API, Charts, Portfolio, Watchlist, Recommendation, Theme
 */
(() => {

    // ── Pre-warm cache immediately (before any DOM work) ────────────────────
    // All requests go through the stale-while-revalidate cache, so these are
    // no-ops if localStorage already has fresh data — otherwise they populate it.
    API.getMarkets(1, 100).catch(() => {});
    API.getGlobal().catch(() => {});
    API.getFearGreed(30).catch(() => {});

    // Preload popular coins: top 20 at the 3 most-used timeframes, staggered
    // to avoid flooding the connection with simultaneous requests.
    const _popularCoins = ['bitcoin','ethereum','solana','binancecoin','ripple',
                           'dogecoin','cardano','avalanche-2','chainlink','polkadot',
                           'tron','shiba-inu','litecoin','near','uniswap',
                           'cosmos','toncoin','arbitrum','sui','pepe'];
    let _preloadIdx = 0;
    const _preloadFrames = [30, 7, 1];
    function _preloadNext() {
        if (_preloadIdx >= _popularCoins.length * _preloadFrames.length) return;
        const coin = _popularCoins[Math.floor(_preloadIdx / _preloadFrames.length)];
        const days = _preloadFrames[_preloadIdx % _preloadFrames.length];
        API.getMarketChart(coin, days).catch(() => {});
        API.getOHLC(coin, days).catch(() => {});
        _preloadIdx++;
        setTimeout(_preloadNext, 80); // stagger 80 ms between requests
    }
    setTimeout(_preloadNext, 500);

    // ── Coin List (single source of truth for all dropdowns) ─────────────────
    let COIN_LIST = [
        { id: 'bitcoin',            name: 'Bitcoin',            symbol: 'BTC'   },
        { id: 'ethereum',           name: 'Ethereum',           symbol: 'ETH'   },
        { id: 'binancecoin',        name: 'BNB',                symbol: 'BNB'   },
        { id: 'solana',             name: 'Solana',             symbol: 'SOL'   },
        { id: 'ripple',             name: 'XRP',                symbol: 'XRP'   },
        { id: 'dogecoin',           name: 'Dogecoin',           symbol: 'DOGE'  },
        { id: 'cardano',            name: 'Cardano',            symbol: 'ADA'   },
        { id: 'tron',               name: 'Tron',               symbol: 'TRX'   },
        { id: 'avalanche-2',        name: 'Avalanche',          symbol: 'AVAX'  },
        { id: 'shiba-inu',          name: 'Shiba Inu',          symbol: 'SHIB'  },
        { id: 'chainlink',          name: 'Chainlink',          symbol: 'LINK'  },
        { id: 'polkadot',           name: 'Polkadot',           symbol: 'DOT'   },
        { id: 'bitcoin-cash',       name: 'Bitcoin Cash',       symbol: 'BCH'   },
        { id: 'near',               name: 'NEAR Protocol',      symbol: 'NEAR'  },
        { id: 'litecoin',           name: 'Litecoin',           symbol: 'LTC'   },
        { id: 'uniswap',            name: 'Uniswap',            symbol: 'UNI'   },
        { id: 'cosmos',             name: 'Cosmos',             symbol: 'ATOM'  },
        { id: 'aptos',              name: 'Aptos',              symbol: 'APT'   },
        { id: 'hedera-hashgraph',   name: 'Hedera',             symbol: 'HBAR'  },
        { id: 'internet-computer',  name: 'Internet Computer',  symbol: 'ICP'   },
        { id: 'monero',             name: 'Monero',             symbol: 'XMR'   },
        { id: 'ethereum-classic',   name: 'Ethereum Classic',   symbol: 'ETC'   },
        { id: 'stellar',            name: 'Stellar',            symbol: 'XLM'   },
        { id: 'vechain',            name: 'VeChain',            symbol: 'VET'   },
        { id: 'algorand',           name: 'Algorand',           symbol: 'ALGO'  },
        { id: 'filecoin',           name: 'Filecoin',           symbol: 'FIL'   },
        { id: 'injective-protocol', name: 'Injective',          symbol: 'INJ'   },
        { id: 'render-token',       name: 'Render',             symbol: 'RNDR'  },
        { id: 'matic-network',      name: 'Polygon',            symbol: 'MATIC' },
        { id: 'the-graph',          name: 'The Graph',          symbol: 'GRT'   },
        { id: 'fetch-ai',           name: 'Fetch.AI',           symbol: 'FET'   },
        { id: 'toncoin',            name: 'Toncoin',            symbol: 'TON'   },
        { id: 'arbitrum',           name: 'Arbitrum',           symbol: 'ARB'   },
        { id: 'optimism',           name: 'Optimism',           symbol: 'OP'    },
        { id: 'fantom',             name: 'Fantom',             symbol: 'FTM'   },
        { id: 'aave',               name: 'Aave',               symbol: 'AAVE'  },
        { id: 'maker',              name: 'Maker',              symbol: 'MKR'   },
        { id: 'the-sandbox',        name: 'The Sandbox',        symbol: 'SAND'  },
        { id: 'decentraland',       name: 'Decentraland',       symbol: 'MANA'  },
        { id: 'axie-infinity',      name: 'Axie Infinity',      symbol: 'AXS'   },
        { id: 'stacks',             name: 'Stacks',             symbol: 'STX'   },
        { id: 'lido-dao',           name: 'Lido DAO',           symbol: 'LDO'   },
        { id: 'curve-dao-token',    name: 'Curve DAO',          symbol: 'CRV'   },
        { id: 'sui',                name: 'Sui',                symbol: 'SUI'   },
        { id: 'sei-network',        name: 'Sei',                symbol: 'SEI'   },
        { id: 'pepe',               name: 'Pepe',               symbol: 'PEPE'  },
        { id: 'kaspa',              name: 'Kaspa',              symbol: 'KAS'   },
        { id: 'floki',              name: 'Floki',              symbol: 'FLOKI' },
        { id: 'worldcoin-wld',      name: 'Worldcoin',          symbol: 'WLD'   },
        { id: 'mantle',             name: 'Mantle',             symbol: 'MNT'   },
    ];

    // ── Coin icon fallback — SVG avatar when CDN image 404s ─────────────────
    const ICON_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#f43f5e','#84cc16','#0ea5e9','#a855f7'];
    window.coinImgFallback = function(img, symbol) {
        img.onerror = null;
        const sym  = (symbol || '?').toUpperCase();
        const abbr = sym.slice(0, sym.length > 4 ? 3 : sym.length);
        const bg   = ICON_COLORS[sym.charCodeAt(0) % ICON_COLORS.length];
        const sz   = img.width || 24;
        const fs   = Math.max(7, Math.round(sz * (abbr.length > 2 ? 0.32 : 0.38)));
        img.src = `data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='${sz}' height='${sz}'>` +
            `<circle cx='${sz/2}' cy='${sz/2}' r='${sz/2}' fill='${bg}'/>` +
            `<text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' ` +
            `font-family='monospace' font-weight='700' font-size='${fs}' fill='white'>${abbr}</text>` +
            `</svg>`
        )}`;
    };

    function buildOptions(coins) {
        return coins.map(c => `<option value="${c.id}">${c.name} (${c.symbol})</option>`).join('');
    }

    function populateCoinSelects() {
        const opts = buildOptions(COIN_LIST);
        // Simple selects — full list, first item selected by default
        ['chartCoinSelect', 'predCoinSelect', 'portfolioCoinSelect', 'watchlistCoinSelect'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = opts;
        });
        // Compare selects — full list, different defaults
        const cmp1 = document.getElementById('cmpCoin1');
        const cmp2 = document.getElementById('cmpCoin2');
        const cmp3 = document.getElementById('cmpCoin3');
        if (cmp1) { cmp1.innerHTML = opts; cmp1.value = 'bitcoin'; }
        if (cmp2) { cmp2.innerHTML = opts; cmp2.value = 'ethereum'; }
        if (cmp3) {
            cmp3.innerHTML = '<option value="">— None —</option>' + opts;
            cmp3.value = 'solana';
        }
    }

    // ── Custom Select Initializer ────────────────────────────────────────────
    function initCustomSelects() {
        const coinSelectIds = [
            'chartCoinSelect', 'predCoinSelect', 'portfolioCoinSelect',
            'watchlistCoinSelect', 'cmpCoin1', 'cmpCoin2', 'cmpCoin3',
        ];
        coinSelectIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el._customSelect) {
                el._customSelect = new CustomSelect(el, { className: 'csel-coin' });
            }
        });

        // Annotation type — no search needed for small fixed list
        const annotEl = document.getElementById('annotationType');
        if (annotEl && !annotEl._customSelect) {
            annotEl._customSelect = new CustomSelect(annotEl, { noSearch: true });
        }
    }

    // ── State ────────────────────────────────────────────────────────────────
    let currentCoin      = 'bitcoin';
    let currentDays      = 30;
    let currentChartType = 'line';
    let lastRSI          = [];
    let lastMACD         = {};
    let lastTs           = [];
    let lastPredSlope    = 0;
    let lastR2           = 0;
    let editingId        = null;
    let coinDetailModal  = null;
    let marketCache      = [];
    let chartRenderSeq   = 0;

    // ── Formatters ───────────────────────────────────────────────────────────
    const fmt = {
        usd(v) {
            if (v == null || isNaN(v)) return '—';
            if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
            if (v >= 1e9)  return '$' + (v / 1e9).toFixed(2)  + 'B';
            if (v >= 1e6)  return '$' + (v / 1e6).toFixed(2)  + 'M';
            if (v >= 1e3)  return '$' + v.toLocaleString(undefined, { maximumFractionDigits: 2 });
            return '$' + v.toFixed(v < 1 ? 6 : 2);
        },
        pct(v)  { return v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; },
        pnl(v)  { return v == null ? '—' : (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(2); },
        num(v)  { return v == null ? '—' : v.toLocaleString(); },
    };

    function pctBadge(v) {
        if (v == null) return '<span class="text-muted">—</span>';
        const cls  = v >= 0 ? 'badge-up' : 'badge-down';
        const icon = v >= 0 ? '▲' : '▼';
        return `<span class="${cls}">${icon} ${Math.abs(v).toFixed(2)}%</span>`;
    }

    // ── Toast ────────────────────────────────────────────────────────────────
    function toast(msg, type = 'info') {
        const palette = { success: '#00e5a0', danger: '#ff3d5a', info: '#00d4ff', warning: '#fbbf24' };
        const c  = palette[type] || palette.info;
        const id = 'toast-' + Date.now();
        document.getElementById('toastContainer').insertAdjacentHTML('beforeend', `
            <div id="${id}" class="toast show align-items-center border-0"
                 style="background:${c}18;border:1px solid ${c}40!important;min-width:260px;border-radius:10px;color:var(--text)">
                <div class="d-flex">
                    <div class="toast-body" style="font-size:0.84rem">${msg}</div>
                    <button type="button" class="btn-close me-2 m-auto" style="filter:invert(1)" onclick="this.closest('.toast').remove()"></button>
                </div>
            </div>`);
        setTimeout(() => document.getElementById(id)?.remove(), 4000);
    }

    // ── Market Sentiment Analysis ────────────────────────────────────────────
    function calcSentimentScore(markets, globalData, fgValue) {
        const btc  = markets.find(c => c.id === 'bitcoin') || {};
        const norm = (v, lo, hi) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));

        const p24h     = btc.price_change_percentage_24h || 0;
        const p7d      = btc.price_change_percentage_7d_in_currency || 0;
        const btcDom   = globalData.data.market_cap_percentage.btc;
        const volRatio = (globalData.data.total_volume.usd / globalData.data.total_market_cap.usd) * 100;

        const factors = {
            priceMovement:   Math.round(norm(p24h, -15, 15)),
            trendStrength:   Math.round(norm(p7d, -30, 30)),
            volumeActivity:  Math.round(norm(volRatio, 0, 18)),
            marketSentiment: Math.round(fgValue),
            cryptoDiversif:  Math.round(norm(100 - btcDom, 30, 65)),
        };

        const score = Math.round(
            factors.priceMovement   * 0.20 +
            factors.trendStrength   * 0.20 +
            factors.volumeActivity  * 0.10 +
            factors.marketSentiment * 0.40 +
            factors.cryptoDiversif  * 0.10
        );
        return { score: Math.max(0, Math.min(100, score)), factors };
    }

    function getSentimentInfo(score) {
        if (score <= 20) return {
            level: 'Extreme Fear', color: '#ff3d5a', icon: 'bi-emoji-dizzy-fill',
            rec: 'Strong Buy Opportunity',
            recDetail: 'Markets are overwhelmingly fearful. Historically, extreme fear levels coincide with major market bottoms and exceptional long-term buying opportunities.',
            explanation: `A composite score of ${score}/100 signals extreme fear. Investors are panic-selling and sentiment is overwhelmingly negative. Fundamentals rarely justify this level of fear — contrarian investors often find exceptional value here.`,
        };
        if (score <= 40) return {
            level: 'Fear', color: '#ff8c42', icon: 'bi-emoji-frown-fill',
            rec: 'Consider Accumulating',
            recDetail: 'Market fear is elevated. Dollar-cost averaging during fearful periods has historically produced strong long-term returns for patient investors.',
            explanation: `A score of ${score}/100 reflects market-wide fear. Selling pressure is dominant and investor confidence is low. This cautious environment may present accumulation opportunities.`,
        };
        if (score <= 60) return {
            level: 'Neutral', color: '#fbbf24', icon: 'bi-emoji-neutral-fill',
            rec: 'Hold & Monitor Closely',
            recDetail: 'Market sentiment is balanced. Wait for clearer directional signals before making significant position changes.',
            explanation: `A score of ${score}/100 indicates a balanced market. Buyers and sellers are roughly in equilibrium. Watch for breakouts above or below key technical levels for directional clues.`,
        };
        if (score <= 80) return {
            level: 'Greed', color: '#00e5a0', icon: 'bi-emoji-smile-fill',
            rec: 'Consider Taking Profits',
            recDetail: 'Greed is rising across the market. Gradually reducing exposure and locking in gains is a prudent strategy as euphoria builds.',
            explanation: `A score of ${score}/100 shows mounting greed. Investors are buying enthusiastically and FOMO is rising. This can continue but risk is elevated — be cautious about chasing rallies.`,
        };
        return {
            level: 'Extreme Greed', color: '#00d4ff', icon: 'bi-emoji-laughing-fill',
            rec: 'Caution — Reduce Risk',
            recDetail: 'Euphoria dominates the market. Historically, extreme greed precedes sharp corrections. Strongly consider reducing exposure and protecting gains.',
            explanation: `A score of ${score}/100 signals extreme greed. Market euphoria is at peak levels with valuations stretched. History suggests this is the most dangerous time to add risk — corrections often follow extreme greed phases.`,
        };
    }

    function updateSentimentGaugeEl(score, color) {
        const v      = Math.max(0, Math.min(100, score));
        const arc    = document.getElementById('saArc');
        const needle = document.getElementById('saNeedle');

        if (arc) {
            if (v <= 0) {
                arc.setAttribute('d', 'M 43.43,156.57 A 80,80 0 0,1 43.43,156.58');
            } else if (v >= 100) {
                arc.setAttribute('d', 'M 43.43,156.57 A 80,80 0 1,1 156.57,156.57');
            } else {
                const endAngle = (135 + (v / 100) * 270) * (Math.PI / 180);
                const ex = (100 + 80 * Math.cos(endAngle)).toFixed(2);
                const ey = (100 + 80 * Math.sin(endAngle)).toFixed(2);
                const largeArc = (v / 100) * 270 > 180 ? 1 : 0;
                arc.setAttribute('d', `M 43.43,156.57 A 80,80 0 ${largeArc},1 ${ex},${ey}`);
            }
            arc.setAttribute('stroke', color);
        }

        if (needle) needle.style.transform = `rotate(${-135 + (v / 100) * 270}deg)`;
    }

    function setFactorBar(barId, valId, value, color) {
        const bar = document.getElementById(barId);
        const val = document.getElementById(valId);
        if (bar) { bar.style.width = value + '%'; bar.style.background = color; bar.style.boxShadow = `0 0 8px ${color}40`; }
        if (val) { val.textContent = value; val.style.color = color; }
    }

    function updateSentimentModule(markets, globalData, fgApiData) {
        const fgArr   = fgApiData.data || [];
        const fgValue = parseInt(fgArr[0]?.value || 50);
        const { score, factors } = calcSentimentScore(markets, globalData, fgValue);
        const info = getSentimentInfo(score);

        updateSentimentGaugeEl(score, info.color);

        const scoreEl = document.getElementById('saScoreNum');
        if (scoreEl) { scoreEl.textContent = score; scoreEl.style.color = info.color; }

        const iconEl = document.getElementById('saIcon'), iconWrap = document.getElementById('saIconWrap');
        if (iconEl) { iconEl.className = `bi ${info.icon} sa-icon`; iconEl.style.color = info.color; }
        if (iconWrap) { iconWrap.style.color = info.color; iconWrap.style.borderColor = info.color + '44'; iconWrap.style.background = info.color + '14'; }

        const levelEl = document.getElementById('saLevelBadge');
        if (levelEl) { levelEl.textContent = info.level; levelEl.style.color = info.color; levelEl.style.borderColor = info.color + '44'; levelEl.style.background = info.color + '18'; }

        const btc  = markets.find(c => c.id === 'bitcoin') || {};
        const p24h = btc.price_change_percentage_24h || 0;
        const p7d  = btc.price_change_percentage_7d_in_currency || 0;
        let trendTxt, trendIcon, trendCls;
        if      (p24h > 3 && p7d > 8)   { trendTxt = 'Strongly Bullish'; trendIcon = 'bi-arrow-up-right-circle-fill';   trendCls = 'sa-trend-bull'; }
        else if (p24h > 0 || p7d > 0)   { trendTxt = 'Bullish';          trendIcon = 'bi-arrow-up-circle';              trendCls = 'sa-trend-bull'; }
        else if (p24h < -3 && p7d < -8) { trendTxt = 'Strongly Bearish'; trendIcon = 'bi-arrow-down-right-circle-fill'; trendCls = 'sa-trend-bear'; }
        else if (p24h < 0 || p7d < 0)   { trendTxt = 'Bearish';          trendIcon = 'bi-arrow-down-circle';            trendCls = 'sa-trend-bear'; }
        else                              { trendTxt = 'Sideways';         trendIcon = 'bi-arrow-right-circle';           trendCls = 'sa-trend-neut'; }
        const trendEl = document.getElementById('saTrendBadge');
        if (trendEl) { trendEl.innerHTML = `<i class="bi ${trendIcon}"></i> ${trendTxt}`; trendEl.className = `sa-trend-badge ${trendCls} mt-2`; }

        setFactorBar('sfPriceBar', 'sfPrice', factors.priceMovement,   factors.priceMovement  > 50 ? '#00e5a0' : '#ff3d5a');
        setFactorBar('sfTrendBar', 'sfTrend', factors.trendStrength,   factors.trendStrength  > 50 ? '#00e5a0' : '#ff3d5a');
        setFactorBar('sfVolBar',   'sfVol',   factors.volumeActivity,  '#3b82f6');
        setFactorBar('sfSentBar',  'sfSent',  factors.marketSentiment, info.color);
        setFactorBar('sfDivBar',   'sfDiv',   factors.cryptoDiversif,  '#fbbf24');

        const explEl = document.getElementById('saExplanation');
        if (explEl) explEl.textContent = info.explanation;

        const recBox = document.getElementById('saRecBox'), recIcon = document.getElementById('saRecIcon');
        const recAct = document.getElementById('saRecAction'), recDet = document.getElementById('saRecDetail');
        if (recBox)  { recBox.style.borderColor = info.color + '44'; recBox.style.background = info.color + '0d'; }
        if (recIcon) recIcon.style.color = info.color;
        if (recAct)  { recAct.textContent = info.rec; recAct.style.color = info.color; }
        if (recDet)  recDet.textContent = info.recDetail;

        const tsEl = document.getElementById('saTimestamp');
        if (tsEl) tsEl.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const histData = [...fgArr].reverse()
            .map(d => ({ ts: parseInt(d.timestamp) * 1000, score: parseInt(d.value) }))
            .filter(d => d.ts > 0 && d.score >= 0);
        if (histData.length >= 2) Charts.renderSentimentHistoryChart(histData);
    }

    // ── Fear & Greed Gauge (kept for legacy, elements may not exist) ──────────
    function updateFearGreedGauge(value) {
        const v   = Math.max(0, Math.min(100, value));
        const rad = Math.PI - (v / 100) * Math.PI;
        const r   = 80;

        const endX = 100 + r * Math.cos(rad);
        const endY = 100 - r * Math.sin(rad);

        const color = v <= 25 ? '#ff3d5a' :
                      v <= 45 ? '#ff8c42' :
                      v <= 55 ? '#fbbf24' :
                      v <= 75 ? '#00e5a0' : '#00d4ff';

        const label = v <= 25 ? 'Extreme Fear' :
                      v <= 45 ? 'Fear' :
                      v <= 55 ? 'Neutral' :
                      v <= 75 ? 'Greed' : 'Extreme Greed';

        const arc = document.getElementById('fgArc');
        if (arc) {
            const d = v === 0
                ? 'M 20 100 A 80 80 0 0 0 20 100'
                : `M 20 100 A 80 80 0 0 0 ${endX.toFixed(1)} ${endY.toFixed(1)}`;
            arc.setAttribute('d', d);
            arc.setAttribute('stroke', color);
        }

        const needle = document.getElementById('fgNeedle');
        if (needle) needle.style.transform = `rotate(${(v / 100 - 0.5) * 180}deg)`;

        const valEl   = document.getElementById('fgValue');
        const labelEl = document.getElementById('fgLabel');
        if (valEl)   { valEl.textContent = v; valEl.setAttribute('fill', color); }
        if (labelEl) { labelEl.textContent = label; labelEl.setAttribute('fill', color); }
    }

    // ── Dashboard ────────────────────────────────────────────────────────────
    async function loadDashboard() {
        let dashMarkets = [], dashGlobal = null;
        try {
            // All three run in parallel — total wait = slowest single request, not their sum
            const fgFallback = { data: [{ value: '50', value_classification: 'Neutral', timestamp: String(Math.floor(Date.now() / 1000)) }] };
            let dashFg;
            [dashGlobal, dashMarkets, dashFg] = await Promise.all([
                API.getGlobal(),
                API.getMarkets(1, 100),
                API.getFearGreed(30).catch(() => fgFallback),
            ]);
            const global  = dashGlobal;
            const markets = dashMarkets;
            marketCache  = markets;
            mktAllCoins  = markets; // share with market page — first click is instant

            const g = global.data;

            document.getElementById('marketStats').innerHTML = `
                <span><i class="bi bi-globe text-primary"></i> MCap: ${fmt.usd(g.total_market_cap.usd)}</span>
                <span><i class="bi bi-currency-bitcoin text-warning"></i> BTC Dom: ${g.market_cap_percentage.btc.toFixed(1)}%</span>
                <span><i class="bi bi-activity text-success"></i> 24h Vol: ${fmt.usd(g.total_volume.usd)}</span>`;

            document.getElementById('totalMarketCap').textContent = fmt.usd(g.total_market_cap.usd);
            document.getElementById('totalVolume').textContent    = fmt.usd(g.total_volume.usd);
            document.getElementById('btcDominance').textContent   = g.market_cap_percentage.btc.toFixed(1) + '%';
            document.getElementById('activeCryptos').textContent  = fmt.num(g.active_cryptocurrencies);

            const btc = markets.find(c => c.id === 'bitcoin');
            const eth = markets.find(c => c.id === 'ethereum');
            if (btc) {
                document.getElementById('btcPrice').textContent = fmt.usd(btc.current_price);
                document.getElementById('btcChange').innerHTML  = pctBadge(btc.price_change_percentage_24h);
                const bm = document.getElementById('btcMcap');    if (bm) bm.textContent = fmt.usd(btc.market_cap);
                const bv = document.getElementById('btcVol');     if (bv) bv.textContent  = fmt.usd(btc.total_volume);
                const b7 = document.getElementById('btcChange7d');if (b7) b7.innerHTML    = pctBadge(btc.price_change_percentage_7d_in_currency);
            }
            if (eth) {
                document.getElementById('ethPrice').textContent = fmt.usd(eth.current_price);
                document.getElementById('ethChange').innerHTML  = pctBadge(eth.price_change_percentage_24h);
                const em = document.getElementById('ethMcap');    if (em) em.textContent = fmt.usd(eth.market_cap);
                const ev = document.getElementById('ethVol');     if (ev) ev.textContent  = fmt.usd(eth.total_volume);
                const e7 = document.getElementById('ethChange7d');if (e7) e7.innerHTML    = pctBadge(eth.price_change_percentage_7d_in_currency);
            }

            const tickerHTML = markets.slice(0, 25).map(c => {
                const up  = (c.price_change_percentage_24h || 0) >= 0;
                return `<span class="ticker-item">
                    <img src="${c.image}" onerror="coinImgFallback(this,'${c.symbol}')" style="width:15px;height:15px;border-radius:50%;vertical-align:middle">
                    <strong>${c.symbol.toUpperCase()}</strong>
                    ${fmt.usd(c.current_price)}
                    <span class="${up ? 'up' : 'down'}">${up ? '▲' : '▼'}${Math.abs(c.price_change_percentage_24h || 0).toFixed(2)}%</span>
                </span>`;
            }).join('<span class="ticker-sep"></span>');
            document.getElementById('tickerContent').innerHTML = tickerHTML;

            const ranked = [...markets].filter(c => c.price_change_percentage_24h != null);
            const sorted = [...ranked].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
            const gainers = sorted.slice(0, 5);
            const losers  = sorted.slice(-5).reverse();

            const gl_row = (c) => `
                <tr onclick="window.showCoinDetail('${c.id}')" style="cursor:pointer">
                    <td><div class="d-flex align-items-center gap-2">
                        <img src="${c.image}" class="coin-icon" width="22" height="22" onerror="coinImgFallback(this,'${c.symbol}')">
                        <div><div class="fw-semibold">${c.name}</div><div class="text-muted" style="font-size:0.72rem">${c.symbol.toUpperCase()}</div></div>
                    </div></td>
                    <td class="fw-semibold" style="font-family:var(--font-mono)">${fmt.usd(c.current_price)}</td>
                    <td>${pctBadge(c.price_change_percentage_24h)}</td>
                </tr>`;

            document.getElementById('gainersBody').innerHTML = gainers.map(gl_row).join('');
            document.getElementById('losersBody').innerHTML  = losers.map(gl_row).join('');

            document.getElementById('coinsTableBody').innerHTML = markets.slice(0, 50).map((c, i) => `
                <tr onclick="window.showCoinDetail('${c.id}')" style="cursor:pointer">
                    <td class="text-muted">${i + 1}</td>
                    <td><div class="d-flex align-items-center gap-2">
                        <img src="${c.image}" class="coin-icon" loading="lazy" onerror="coinImgFallback(this,'${c.symbol}')" width="24" height="24">
                        <div><div class="fw-semibold">${c.name}</div><div class="text-muted" style="font-size:0.73rem">${c.symbol.toUpperCase()}</div></div>
                    </div></td>
                    <td style="font-family:var(--font-mono)" class="fw-semibold">${fmt.usd(c.current_price)}</td>
                    <td>${pctBadge(c.price_change_percentage_24h)}</td>
                    <td>${pctBadge(c.price_change_percentage_7d_in_currency)}</td>
                    <td>${fmt.usd(c.market_cap)}</td>
                    <td>${fmt.usd(c.total_volume)}</td>
                    <td><button class="btn btn-outline-primary btn-sm" onclick="event.stopPropagation();window.viewChart('${c.id}')">
                        <i class="bi bi-graph-up"></i></button></td>
                </tr>`).join('');

            if (dashMarkets.length && dashGlobal) updateSentimentModule(dashMarkets, dashGlobal, dashFg);

        } catch (err) {
            console.error(err);
            toast('Failed to load market data: ' + err.message, 'danger');
            document.getElementById('coinsTableBody').innerHTML =
                `<tr><td colspan="8" class="text-center text-danger py-4"><i class="bi bi-exclamation-circle fs-4 d-block mb-1"></i>${err.message}</td></tr>`;
        }
    }

    // ── Coin Detail Modal ────────────────────────────────────────────────────
    window.showCoinDetail = async function (coinId) {
        coinDetailModal?.show();
        try {
            const d  = await API.getCoinDetail(coinId);
            const md = d.market_data;
            const mdIconEl = document.getElementById('mdIcon');
            mdIconEl.onerror = () => coinImgFallback(mdIconEl, d.symbol);
            mdIconEl.src = d.image.small;
            document.getElementById('mdName').textContent = d.name;
            document.getElementById('mdSymbol').textContent = d.symbol.toUpperCase();
            document.getElementById('mdPrice').textContent  = fmt.usd(md.current_price.usd);
            document.getElementById('md24h').innerHTML      = pctBadge(md.price_change_percentage_24h);
            document.getElementById('mdMcap').textContent   = fmt.usd(md.market_cap.usd);
            document.getElementById('mdVol').textContent    = fmt.usd(md.total_volume.usd);
            document.getElementById('mdHigh').textContent   = fmt.usd(md.high_24h.usd);
            document.getElementById('mdLow').textContent    = fmt.usd(md.low_24h.usd);
            document.getElementById('mdATH').textContent    = fmt.usd(md.ath.usd);
            document.getElementById('mdSupply').textContent = fmt.num(Math.round(md.circulating_supply));

            document.getElementById('mdViewChart').onclick = () => {
                coinDetailModal?.hide();
                window.viewChart(coinId);
            };
            document.getElementById('mdAddWatch').onclick = () => {
                const added = Watchlist.add(coinId, d.name, d.symbol.toUpperCase());
                toast(added ? `${d.name} added to watchlist!` : 'Already in watchlist.', added ? 'success' : 'info');
            };
        } catch (err) {
            toast('Could not load coin details: ' + err.message, 'danger');
        }
    };

    // ── View Chart (from any module) ─────────────────────────────────────────
    window.viewChart = function (coinId) {
        currentCoin = coinId;
        const sel = document.getElementById('chartCoinSelect');
        if (sel) {
            sel.value = coinId;
            sel._customSelect?.refresh();
        }
        // Switch tab directly
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('show', 'active'));
        const chartsPane = document.querySelector('#charts');
        if (chartsPane) {
            chartsPane.classList.add('active');
            requestAnimationFrame(() => chartsPane.classList.add('show'));
        }
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        document.querySelector('.sidebar-link[href="#charts"]')?.classList.add('active');
        // Instant scroll — completes synchronously before loadChart() renders any content
        window.scrollTo({ top: 0 });
        loadChart();
    };

    // ── Charts ───────────────────────────────────────────────────────────────

    // Pre-fetch all 5 timeframes for a coin so every timeframe button is instant
    function warmCoinAllFrames(coinId) {
        const sym = COIN_LIST.find(c => c.id === coinId)?.symbol || '';
        [1, 7, 30, 90, 365].forEach(d => API.getMarketChart(coinId, d, sym).catch(() => {}));
        [1, 7, 30, 90, 365].forEach(d => API.getOHLC(coinId, d, sym).catch(() => {}));
    }

    async function loadChart() {
        WS.disconnect(); // Stop any previous live feed before starting a new load
        const token = ++chartRenderSeq;
        const stale = () => chartRenderSeq !== token;

        const coinId = document.getElementById('chartCoinSelect').value;

        // Persist drawings for the outgoing coin before switching.
        TrendDraw.saveCoin(currentCoin);

        currentCoin  = coinId;
        // Pre-fetch all other timeframes for this coin in the background
        warmCoinAllFrames(coinId);

        // Deactivate draw mode but keep per-coin drawings intact.
        TrendDraw.deactivate();
        const drawBtn  = document.getElementById('drawTrendBtn');
        const drawPanel = document.getElementById('drawPanel');
        if (drawBtn)   { drawBtn.classList.remove('active'); drawBtn.innerHTML = '<i class="bi bi-pencil"></i> <span>Draw</span>'; }
        if (drawPanel) drawPanel.style.display = 'none';
        document.querySelectorAll('.draw-tool-btn').forEach(b => b.classList.remove('active'));
        const firstTool = document.querySelector('.draw-tool-btn[data-tool="line"]');
        if (firstTool) firstTool.classList.add('active');

        try {
            const coinSym = COIN_LIST.find(c => c.id === coinId)?.symbol || '';
            const [chartData, ohlcData] = await Promise.all([
                API.getMarketChart(coinId, currentDays, coinSym),
                API.getOHLC(coinId, currentDays, coinSym),
            ]);

            if (stale()) return;

            const timestamps = chartData.prices.map(p => p[0]);
            const prices     = chartData.prices.map(p => p[1]);
            const volumes    = chartData.total_volumes.map(p => p[1]);

            const ptsPer24h = currentDays <= 1 ? prices.length : currentDays <= 7 ? 24 : currentDays <= 30 ? 6 : 1;
            const last24h   = prices.slice(-ptsPer24h);
            const high24    = last24h.length ? Math.max(...last24h) : null;
            const low24     = last24h.length ? Math.min(...last24h) : null;

            const coinMeta = COIN_LIST.find(c => c.id === coinId);
            const chartIconEl = document.getElementById('chartCoinIcon');
            chartIconEl.onerror = () => coinImgFallback(chartIconEl, coinMeta?.symbol || coinId);
            chartIconEl.src = `https://assets.coincap.io/assets/icons/${(coinMeta?.symbol || coinId).toLowerCase()}@2x.png`;
            document.getElementById('chartCoinName').textContent     = coinMeta?.name || coinId;
            document.getElementById('chartCoinSymbol').textContent   = coinMeta?.symbol || '';
            document.getElementById('chartCurrentPrice').textContent = fmt.usd(prices.at(-1));
            document.getElementById('chart24hHigh').textContent      = fmt.usd(high24);
            document.getElementById('chart24hLow').textContent       = fmt.usd(low24);
            document.getElementById('chart24hChange').innerHTML      = '';
            document.getElementById('chartMarketCap').textContent    = '—';

            lastTs   = timestamps;
            lastRSI  = Indicators.rsi(prices, 14);
            lastMACD = Indicators.macd(prices);

            if (stale()) return;

            // Hide while ApexCharts builds the SVG — prevents user seeing half-rendered state.
            // Using transition:none for the exit so only the entrance is animated.
            const chartEl = document.getElementById('mainChart');
            chartEl.style.transition = 'none';
            chartEl.style.opacity    = '0';

            await Charts.renderMainChart(currentChartType, timestamps, prices, ohlcData);

            if (stale()) { chartEl.style.opacity = '1'; return; }

            // Double-RAF: first RAF queues a paint, second fires after that paint commits.
            // This guarantees opacity=1 starts transitioning from a fully-painted state — no jank.
            requestAnimationFrame(() => requestAnimationFrame(() => {
                chartEl.style.transition = 'opacity 0.32s ease';
                chartEl.style.opacity    = '1';
                // Remove inline styles once the transition ends so nothing stays dirty
                setTimeout(() => { chartEl.style.transition = ''; chartEl.style.opacity = ''; }, 360);
            }));

            Charts.renderVolumeChart(timestamps, volumes);
            // RSI/MACD are hidden by default — render only if user has already visited those tabs
            if (Charts.hasRSI())  Charts.renderRSIChart(timestamps, lastRSI);
            if (Charts.hasMACD()) Charts.renderMACDChart(timestamps, lastMACD);
            // Restore per-coin drawings and subscribe to scroll/zoom on the new chart instance.
            setTimeout(() => TrendDraw.loadCoin(coinId), 80);

            // Fill 24h change and market cap from already-loaded cache — no extra API call needed
            const marketEntry = marketCache.find(m => m.id === coinId);
            if (marketEntry) {
                document.getElementById('chart24hChange').innerHTML    = pctBadge(marketEntry.price_change_percentage_24h);
                document.getElementById('chartMarketCap').textContent  = fmt.usd(marketEntry.market_cap);
            }

            // ── Connect WebSocket for live price updates ─────────────────────
            const wsSymbol   = API.getWsSymbol(coinId, coinSym);
            const wsInterval = API.getWsInterval(currentDays);
            if (wsSymbol) {
                WS.connect(wsSymbol, wsInterval, {
                    onTicker(t) {
                        if (stale()) return;
                        document.getElementById('chartCurrentPrice').textContent = fmt.usd(t.price);
                        document.getElementById('chart24hChange').innerHTML      = pctBadge(t.change24h);
                        document.getElementById('chart24hHigh').textContent      = fmt.usd(t.high24);
                        document.getElementById('chart24hLow').textContent       = fmt.usd(t.low24);
                    },
                    onKline(k) {
                        if (stale()) return;
                        // Incremental O(1) update — TVLWC series.update() patches only
                        // the changed bar instead of rebuilding the entire chart SVG.
                        Charts.updateMainChartBar(
                            { time: Math.floor(k.t / 1000), open: k.o, high: k.h, low: k.l, close: k.c },
                            k.v,
                        );
                    },
                });
            }

        } catch (err) {
            if (stale()) return;
            document.getElementById('mainChart').innerHTML =
                `<div class="text-center text-danger py-5"><i class="bi bi-wifi-off fs-2 d-block mb-2"></i>${err.message}</div>`;
            toast('Chart failed: ' + err.message, 'danger');
        }
    }

    // ── Prediction ───────────────────────────────────────────────────────────
    async function runPrediction() {
        const coinId   = document.getElementById('predCoinSelect').value;
        const predDays = parseInt(document.getElementById('predDays').value);
        const histDays = parseInt(document.getElementById('predHistoryDays').value);

        if (!predDays || predDays < 1 || predDays > 30) {
            toast('Enter 1–30 days to predict.', 'warning'); return;
        }

        const predChartEl = document.getElementById('predictionChart');

        // Destroy the live ApexCharts instance FIRST — prevents its internal
        // ResizeObserver from re-rendering the old chart back into the container
        // after we clear it (which was the root cause of the flash).
        Charts.clearPredChart();

        predChartEl.innerHTML = '<div class="d-flex justify-content-center align-items-center" style="flex:1;min-height:420px"><div class="spinner-border text-primary"></div></div>';

        document.getElementById('predStats').innerHTML           = '<div class="pred-computing"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Computing…</div>';
        document.getElementById('recommendationPanel').innerHTML = '<div class="pred-computing"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Computing…</div>';

        try {
            const predSym   = COIN_LIST.find(c => c.id === coinId)?.symbol || '';
            const chartData = await API.getMarketChart(coinId, histDays, predSym);
            const histChart = await API.getMarketChart(coinId, 30, predSym);

            const timestamps = chartData.prices.map(p => p[0]);
            const prices     = chartData.prices.map(p => p[1]);

            const { fitted, future, slope, r2 } = Prediction.predict(prices, predDays);
            lastPredSlope = slope;
            lastR2        = r2;

            const dayMs      = 86_400_000;
            const lastTs     = timestamps.at(-1);
            const futureDates = Array.from({ length: predDays }, (_, i) => lastTs + dayMs * (i + 1));

            const current   = prices.at(-1);
            const predicted = future.at(-1);
            const pctChange = ((predicted - current) / current) * 100;

            const r2Color  = r2 > 0.8 ? 'var(--green)' : r2 > 0.5 ? 'var(--yellow)' : 'var(--text-dim)';
            const r2Label  = r2 > 0.8 ? 'Strong fit' : r2 > 0.5 ? 'Moderate fit' : 'Weak fit';
            document.getElementById('predStats').innerHTML = `
                <div class="pred-stats-grid">
                    <div class="pred-stat-item">
                        <div class="pred-stat-label">Current Price</div>
                        <div class="pred-stat-value">${fmt.usd(current)}</div>
                    </div>
                    <div class="pred-stat-item">
                        <div class="pred-stat-label">Predicted (${predDays}d)</div>
                        <div class="pred-stat-value ${pctChange >= 0 ? 'text-green' : 'text-red'}">${fmt.usd(predicted)}</div>
                    </div>
                    <div class="pred-stat-item">
                        <div class="pred-stat-label">Expected Change</div>
                        <div class="pred-stat-value ${pctChange >= 0 ? 'text-green' : 'text-red'}">${fmt.pct(pctChange)}</div>
                    </div>
                    <div class="pred-stat-item">
                        <div class="pred-stat-label">Trend</div>
                        <div class="pred-stat-value ${slope >= 0 ? 'text-green' : 'text-red'}">${slope >= 0 ? '▲ Upward' : '▼ Downward'}</div>
                    </div>
                    <div class="pred-stat-item pred-stat-wide">
                        <div class="pred-stat-label">R² Fit Quality</div>
                        <div class="d-flex align-items-center gap-2 mt-1">
                            <div class="pred-r2-bar-wrap"><div class="pred-r2-bar" style="width:${(r2*100).toFixed(1)}%;background:${r2Color}"></div></div>
                            <span class="pred-stat-value" style="color:${r2Color}">${(r2*100).toFixed(1)}%</span>
                            <span style="font-size:0.72rem;color:${r2Color}">${r2Label}</span>
                        </div>
                    </div>
                </div>
            `;

            const indPrices = histChart.prices.map(p => p[1]);
            const rsiVals   = Indicators.rsi(indPrices, 14);
            const macdData  = Indicators.macd(indPrices);
            const rec       = Recommendation.analyze(rsiVals, macdData, slope, r2);

            const recColors = { BUY: 'text-green', SELL: 'text-red', HOLD: 'text-warning' };
            const recIcons  = { BUY: 'bi-hand-thumbs-up-fill', SELL: 'bi-hand-thumbs-down-fill', HOLD: 'bi-pause-circle-fill' };
            const recBg     = { BUY: 'rgba(0,229,160,0.08)', SELL: 'rgba(255,61,90,0.08)', HOLD: 'rgba(251,191,36,0.08)' };

            const recAccent = rec.action === 'BUY' ? 'var(--green)' : rec.action === 'SELL' ? 'var(--red)' : 'var(--yellow)';
            document.getElementById('recommendationPanel').innerHTML = `
                <div class="pred-rec-verdict" style="--rec-color:${recAccent}">
                    <i class="bi ${recIcons[rec.action]} pred-rec-icon ${recColors[rec.action]}"></i>
                    <div class="pred-rec-action ${recColors[rec.action]}">${rec.action}</div>
                    <div class="pred-rec-conf">Confidence: <strong>${rec.confidence}%</strong></div>
                    <div class="pred-rec-bar-wrap">
                        <div class="pred-rec-bar" style="width:${rec.confidence}%;background:${recAccent}"></div>
                    </div>
                </div>
                <ul class="pred-rec-reasons">
                    ${rec.reasons.map(r => `<li><i class="bi bi-chevron-right"></i>${r}</li>`).join('')}
                </ul>`;

            // Render new chart then kick the entrance animation.
            // Do NOT clear innerHTML here — renderPredictionChart reads el.offsetHeight
            // first (while spinner is still inside) then clears and renders at that height.
            predChartEl.classList.remove('pred-chart-enter');
            Charts.renderPredictionChart(timestamps, prices, futureDates, fitted, future);

            // Force reflow so browser registers the class removal before re-adding it,
            // guaranteeing the keyframe restarts from the beginning every time.
            void predChartEl.offsetHeight;
            predChartEl.classList.add('pred-chart-enter');
            setTimeout(() => predChartEl.classList.remove('pred-chart-enter'), 500);

        } catch (err) {
            predChartEl.innerHTML =
                `<div class="text-center text-danger py-5"><i class="bi bi-exclamation-circle fs-2 d-block mb-2"></i>${err.message}</div>`;
            toast('Prediction failed: ' + err.message, 'danger');
        }
    }

    // ── Portfolio ────────────────────────────────────────────────────────────
    function resetPortfolioForm() {
        editingId = null;
        document.getElementById('editingHoldingId').value   = '';
        document.getElementById('portfolioFormTitle').innerHTML = '<i class="bi bi-plus-circle"></i> Add Holding';
        document.getElementById('addHoldingBtn').innerHTML  = '<i class="bi bi-plus-lg"></i> Add to Portfolio';
        document.getElementById('cancelEditBtn').classList.add('d-none');
        document.getElementById('portfolioCoinSelect').disabled = false;
        document.getElementById('portfolioQty').value       = '';
        document.getElementById('portfolioBuyPrice').value  = '';
        document.getElementById('portfolioBuyDate').value   = new Date().toISOString().split('T')[0];
        document.getElementById('portfolioError').textContent = '';
        // Refresh custom select to reflect enabled state
        document.getElementById('portfolioCoinSelect')._customSelect?.refresh();
    }

    window.editHolding = function (id) {
        const h = Portfolio.getById(id);
        if (!h) return;
        editingId = id;
        document.getElementById('editingHoldingId').value   = id;
        document.getElementById('portfolioFormTitle').innerHTML = '<i class="bi bi-pencil"></i> Edit Holding';
        document.getElementById('addHoldingBtn').innerHTML  = '<i class="bi bi-check-lg"></i> Update Holding';
        document.getElementById('cancelEditBtn').classList.remove('d-none');
        document.getElementById('portfolioCoinSelect').value    = h.coinId;
        document.getElementById('portfolioCoinSelect')._customSelect?.refresh();
        document.getElementById('portfolioCoinSelect').disabled = true;
        document.getElementById('portfolioQty').value       = h.qty;
        document.getElementById('portfolioBuyPrice').value  = h.buyPrice;
        document.getElementById('portfolioBuyDate').value   = h.buyDate;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.removeHolding = function (id) {
        Portfolio.remove(id);
        if (editingId === id) resetPortfolioForm();
        refreshPortfolio();
        toast('Holding removed.', 'info');
    };

    async function refreshPortfolio() {
        const holdings = Portfolio.getAll();
        const tbody    = document.getElementById('holdingsTableBody');

        if (!holdings.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No holdings yet. Add your first crypto above.</td></tr>';
            ['portfolioTotalValue','portfolioTotalCost'].forEach(id => document.getElementById(id).textContent = '$0.00');
            document.getElementById('portfolioTotalPnL').textContent = '$0.00';
            document.getElementById('portfolioTotalPnL').className   = 'fs-5 fw-bold';
            document.getElementById('portfolioROI').textContent      = '0.00%';
            document.getElementById('portfolioROI').className        = 'fs-5 fw-bold';
            document.getElementById('bestAsset').textContent  = '—';
            document.getElementById('worstAsset').textContent = '—';
            Charts.renderAllocationChart([], []);
            return;
        }

        try {
            const prices = await API.getSimplePrice(Portfolio.getUniqueCoinIds());

            let totalValue = 0, totalCost = 0;
            const allocLabels = [], allocValues = [];
            const performances = [];

            tbody.innerHTML = holdings.map(h => {
                const curPrice = prices[h.coinId]?.usd || 0;
                const curValue = curPrice * h.qty;
                const cost     = h.buyPrice * h.qty;
                const pnl      = curValue - cost;
                const pnlPct   = cost > 0 ? (pnl / cost) * 100 : 0;

                totalValue += curValue;
                totalCost  += cost;

                const ei = allocLabels.indexOf(h.symbol);
                if (ei >= 0) allocValues[ei] += curValue;
                else { allocLabels.push(h.symbol); allocValues.push(curValue); }

                performances.push({ name: h.name, symbol: h.symbol, pnlPct });

                return `
                    <tr>
                        <td><strong>${h.name}</strong> <span class="text-muted">${h.symbol}</span></td>
                        <td style="font-family:var(--font-mono)">${h.qty}</td>
                        <td style="font-family:var(--font-mono)">${fmt.usd(h.buyPrice)}</td>
                        <td style="font-family:var(--font-mono)">${fmt.usd(curPrice)}</td>
                        <td style="font-family:var(--font-mono)">${fmt.usd(curValue)}</td>
                        <td class="${pnl >= 0 ? 'text-green' : 'text-red'}" style="font-family:var(--font-mono)">${fmt.pnl(pnl)}</td>
                        <td class="${pnl >= 0 ? 'text-green' : 'text-red'}">${fmt.pct(pnlPct)}</td>
                        <td><span class="text-muted small">${h.buyDate || '—'}</span></td>
                        <td>
                            <div class="d-flex gap-1">
                                <button class="btn btn-outline-secondary btn-sm" onclick="window.editHolding(${h.id})" title="Edit"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-outline-danger btn-sm" onclick="window.removeHolding(${h.id})" title="Delete"><i class="bi bi-trash"></i></button>
                            </div>
                        </td>
                    </tr>`;
            }).join('');

            const totalPnL = totalValue - totalCost;
            const roi      = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

            document.getElementById('portfolioTotalValue').textContent = fmt.usd(totalValue);
            document.getElementById('portfolioTotalCost').textContent  = fmt.usd(totalCost);

            const pnlEl = document.getElementById('portfolioTotalPnL');
            pnlEl.textContent = fmt.pnl(totalPnL);
            pnlEl.className   = 'fs-5 fw-bold ' + (totalPnL >= 0 ? 'text-green' : 'text-red');

            const roiEl = document.getElementById('portfolioROI');
            roiEl.textContent = fmt.pct(roi);
            roiEl.className   = 'fs-5 fw-bold ' + (roi >= 0 ? 'text-green' : 'text-red');

            if (performances.length) {
                const best  = performances.reduce((a, b) => a.pnlPct > b.pnlPct ? a : b);
                const worst = performances.reduce((a, b) => a.pnlPct < b.pnlPct ? a : b);
                document.getElementById('bestAsset').innerHTML  = `${best.name} <span class="text-green">${fmt.pct(best.pnlPct)}</span>`;
                document.getElementById('worstAsset').innerHTML = `${worst.name} <span class="text-red">${fmt.pct(worst.pnlPct)}</span>`;
            }

            Charts.renderAllocationChart(allocLabels, allocValues);

        } catch (err) {
            toast('Price fetch failed: ' + err.message, 'danger');
        }
    }

    // ── Watchlist ────────────────────────────────────────────────────────────
    async function refreshWatchlist() {
        const coins = Watchlist.getAll();
        const tbody = document.getElementById('watchlistTableBody');

        if (!coins.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Your watchlist is empty. Add coins above.</td></tr>';
            return;
        }

        try {
            const prices = await API.getSimplePrice(Watchlist.getIds());

            tbody.innerHTML = coins.map(c => {
                const p      = prices[c.id];
                const price  = p?.usd ?? null;
                const ch24   = p?.usd_24h_change ?? null;
                return `
                    <tr onclick="window.showCoinDetail('${c.id}')" style="cursor:pointer">
                        <td><strong>${c.name}</strong> <span class="text-muted">${c.symbol}</span></td>
                        <td style="font-family:var(--font-mono)">${fmt.usd(price)}</td>
                        <td>${pctBadge(ch24)}</td>
                        <td>
                            <div class="d-flex gap-1">
                                <button class="btn btn-outline-primary btn-sm" onclick="event.stopPropagation();window.viewChart('${c.id}')" title="Chart"><i class="bi bi-graph-up"></i></button>
                                <button class="btn btn-outline-danger btn-sm" onclick="event.stopPropagation();window.removeFromWatchlist('${c.id}')" title="Remove"><i class="bi bi-star-fill"></i></button>
                            </div>
                        </td>
                    </tr>`;
            }).join('');

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">${err.message}</td></tr>`;
        }
    }

    window.removeFromWatchlist = function (id) {
        Watchlist.remove(id);
        refreshWatchlist();
        toast('Removed from watchlist.', 'info');
    };

    // ── Comparison Tool ──────────────────────────────────────────────────────
    async function runComparison() {
        const ids = [
            document.getElementById('cmpCoin1').value,
            document.getElementById('cmpCoin2').value,
            document.getElementById('cmpCoin3').value,
        ].filter(Boolean);

        if (new Set(ids).size < ids.length) {
            toast('Please select different coins for comparison.', 'warning'); return;
        }
        if (ids.length < 2) {
            toast('Select at least 2 coins to compare.', 'warning'); return;
        }

        document.getElementById('comparePlaceholder').style.display = '';
        document.getElementById('comparePlaceholder').innerHTML =
            '<div class="card cv-card"><div class="card-body text-center py-4"><div class="spinner-border text-primary"></div></div></div>';
        document.getElementById('compareCards').style.display      = 'none';
        document.getElementById('compareChartWrap').style.display  = 'none';

        try {
            const [details, charts] = await Promise.all([
                Promise.all(ids.map(id => API.getCoinDetail(id))),
                Promise.all(ids.map(id => API.getMarketChart(id, 7))),
            ]);

            document.getElementById('comparePlaceholder').style.display = 'none';
            const cardsEl = document.getElementById('compareCardsRow');
            const colMap  = { 2: 'col-md-6', 3: 'col-md-4' };
            const col     = colMap[ids.length] || 'col-md-4';

            cardsEl.innerHTML = details.map((d, i) => {
                const md  = d.market_data;
                const ch  = md.price_change_percentage_24h;
                return `
                    <div class="${col}">
                        <div class="card cv-card">
                            <div class="card-body">
                                <div class="d-flex align-items-center gap-2 mb-3">
                                    <img src="${d.image.small}" width="36" height="36" style="border-radius:50%" onerror="coinImgFallback(this,'${d.symbol}')">
                                    <div><div class="fw-bold fs-5">${d.name}</div><div class="text-muted small">${d.symbol.toUpperCase()}</div></div>
                                </div>
                                <div class="row g-2 text-center">
                                    <div class="col-6"><div class="stat-label">Price</div><div class="fw-bold" style="font-family:var(--font-mono)">${fmt.usd(md.current_price.usd)}</div></div>
                                    <div class="col-6"><div class="stat-label">24h Change</div><div>${pctBadge(ch)}</div></div>
                                    <div class="col-6"><div class="stat-label">Market Cap</div><div class="fw-bold small">${fmt.usd(md.market_cap.usd)}</div></div>
                                    <div class="col-6"><div class="stat-label">Volume 24h</div><div class="fw-bold small">${fmt.usd(md.total_volume.usd)}</div></div>
                                </div>
                            </div>
                        </div>
                    </div>`;
            }).join('');

            document.getElementById('compareCards').style.display = '';

            const datasets = details.map((d, i) => ({
                name:       d.name,
                timestamps: charts[i].prices.map(p => p[0]),
                prices:     charts[i].prices.map(p => p[1]),
            }));

            document.getElementById('compareChartWrap').style.display = '';
            Charts.renderComparisonChart(datasets);

        } catch (err) {
            document.getElementById('comparePlaceholder').innerHTML =
                `<div class="card cv-card"><div class="card-body text-center text-danger py-4">${err.message}</div></div>`;
            document.getElementById('comparePlaceholder').style.display = '';
            toast('Comparison failed: ' + err.message, 'danger');
        }
    }

    // ── Search ───────────────────────────────────────────────────────────────
    async function handleSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) { toast('Enter a coin name or symbol to search.', 'warning'); return; }

        try {
            const result = await API.searchCoins(query);
            if (!result.coins?.length) { toast(`No results found for "${query}"`, 'warning'); return; }
            const coin = result.coins[0];
            window.showCoinDetail(coin.id);
        } catch (err) {
            toast('Search failed: ' + err.message, 'danger');
        }
    }

    // ── Annotations ──────────────────────────────────────────────────────────
    function renderAnnotationList() {
        const container = document.getElementById('annotationsList');
        const list      = Charts.getAnnotations();
        if (!list.length) { container.innerHTML = '<span class="text-muted small">No annotations yet.</span>'; return; }
        const tc = { buy:'text-green', sell:'text-red', note:'text-warning', support:'text-green', resistance:'text-red' };
        container.innerHTML = list.map((a, i) => `
            <span class="annotation-badge">
                <span class="${tc[a.type] || ''}">${a.type.toUpperCase()}</span>
                ${a.date  ? `<span class="text-muted">${a.date}</span>` : ''}
                ${a.price ? `<span>$${Number(a.price).toLocaleString()}</span>` : ''}
                ${a.note  ? `<span>${a.note}</span>` : ''}
                <span class="remove-ann" onclick="window.removeAnnotation(${i})" title="Remove">×</span>
            </span>`).join('');
    }

    window.removeAnnotation = function (i) {
        Charts.removeAnnotation(i);
        renderAnnotationList();
        if (document.getElementById('charts').classList.contains('show')) loadChart();
    };

    // ── Trend Line Drawing Tool ───────────────────────────────────────────────
    // Drawings are stored in chart coordinates (Unix-second time + price) so they
    // move correctly when the user scrolls, zooms, or switches timeframes.
    // Per-coin storage means drawings survive coin switching.
    const TrendDraw = (() => {
        let canvas = null, ctx = null;
        let active   = false;
        let startPt  = null;   // { time, price } pending first point of line/arrow
        let rectStart = null;  // { time, price } pending first corner of rect
        let lines    = [];     // drawings in chart coordinates
        let color    = '#22d3ee';
        let toolType = 'line'; // line | hline | vline | rect | arrow | text

        // Per-coin persistence: coinId → lines[]
        const _coinDrawings = {};
        let _currentCoin = null;

        function getLineWidth() {
            const sel = document.getElementById('drawLineWidth');
            return sel ? parseFloat(sel.value) || 2 : 2;
        }

        function cursorPos(e) {
            const r = canvas.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        }

        function setStatus(msg) {
            const el = document.getElementById('trendStatus');
            if (el) el.textContent = msg;
        }

        function drawArrowhead(ax, ay, bx, by, c, lw) {
            const angle = Math.atan2(by - ay, bx - ax);
            const size  = 10 + lw * 2;
            ctx.save();
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - size * Math.cos(angle - Math.PI / 6), by - size * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(bx - size * Math.cos(angle + Math.PI / 6), by - size * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // Render one stored drawing using current chart coordinate mapping.
        function drawShape(l) {
            ctx.save();
            ctx.strokeStyle = l.c;
            ctx.lineWidth   = l.w || 2;
            ctx.shadowColor = l.c;
            ctx.shadowBlur  = 5;
            ctx.setLineDash([]);

            if (l.type === 'hline') {
                const y = Charts.priceToY(l.price);
                if (y == null) { ctx.restore(); return; }
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();

            } else if (l.type === 'vline') {
                const x = Charts.timeToX(l.time);
                if (x == null) { ctx.restore(); return; }
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();

            } else if (l.type === 'line') {
                const ax = Charts.timeToX(l.t1), ay = Charts.priceToY(l.p1);
                const bx = Charts.timeToX(l.t2), by = Charts.priceToY(l.p2);
                if (ax == null || ay == null || bx == null || by == null) { ctx.restore(); return; }
                ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
                ctx.fillStyle = l.c;
                [[ax, ay], [bx, by]].forEach(([px, py]) => {
                    ctx.beginPath(); ctx.arc(px, py, 3 + (l.w || 2) * 0.5, 0, Math.PI * 2); ctx.fill();
                });

            } else if (l.type === 'arrow') {
                const ax = Charts.timeToX(l.t1), ay = Charts.priceToY(l.p1);
                const bx = Charts.timeToX(l.t2), by = Charts.priceToY(l.p2);
                if (ax == null || ay == null || bx == null || by == null) { ctx.restore(); return; }
                ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
                drawArrowhead(ax, ay, bx, by, l.c, l.w || 2);

            } else if (l.type === 'rect') {
                const ax = Charts.timeToX(l.t1), ay = Charts.priceToY(l.p1);
                const bx = Charts.timeToX(l.t2), by = Charts.priceToY(l.p2);
                if (ax == null || ay == null || bx == null || by == null) { ctx.restore(); return; }
                ctx.strokeRect(ax, ay, bx - ax, by - ay);

            } else if (l.type === 'text') {
                const x = Charts.timeToX(l.time), y = Charts.priceToY(l.price);
                if (x == null || y == null) { ctx.restore(); return; }
                ctx.fillStyle = l.c;
                ctx.font = `bold ${12 + (l.w || 2) * 2}px Inter, sans-serif`;
                ctx.shadowBlur = 8;
                ctx.fillText(l.text, x, y);
            }

            ctx.restore();
        }

        function redraw() {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            lines.forEach(l => drawShape(l));
        }

        function onClick(e) {
            if (!active) return;
            const p  = cursorPos(e);
            const lw = getLineWidth();

            if (toolType === 'hline') {
                const price = Charts.yToPrice(p.y);
                if (price == null) return;
                lines.push({ type: 'hline', price, c: color, w: lw });
                redraw(); setStatus('Horizontal line added. Click to add more...');
                return;
            }

            if (toolType === 'vline') {
                const time = Charts.xToTime(p.x);
                if (time == null) return;
                lines.push({ type: 'vline', time, c: color, w: lw });
                redraw(); setStatus('Vertical line added. Click to add more...');
                return;
            }

            if (toolType === 'text') {
                const txt = prompt('Enter label text:');
                if (txt && txt.trim()) {
                    const time  = Charts.xToTime(p.x);
                    const price = Charts.yToPrice(p.y);
                    if (time == null || price == null) return;
                    lines.push({ type: 'text', time, price, text: txt.trim(), c: color, w: lw });
                    redraw();
                }
                setStatus('Click to add a text label...');
                return;
            }

            if (toolType === 'rect') {
                const time  = Charts.xToTime(p.x);
                const price = Charts.yToPrice(p.y);
                if (time == null || price == null) return;
                if (!rectStart) {
                    rectStart = { time, price };
                    setStatus('Click end corner to complete rectangle...');
                } else {
                    lines.push({ type: 'rect', t1: rectStart.time, p1: rectStart.price, t2: time, p2: price, c: color, w: lw });
                    rectStart = null; redraw();
                    setStatus('Click start corner for a new rectangle...');
                }
                return;
            }

            // line / arrow — two-click
            const time  = Charts.xToTime(p.x);
            const price = Charts.yToPrice(p.y);
            if (time == null || price == null) { setStatus('Click within the chart area...'); return; }
            if (!startPt) {
                startPt = { time, price };
                setStatus('Click end point to complete...');
            } else {
                lines.push({ type: toolType, t1: startPt.time, p1: startPt.price, t2: time, p2: price, c: color, w: lw });
                startPt = null; redraw();
                setStatus('Click start point to draw...');
            }
        }

        function onMove(e) {
            if (!active) return;
            const p = cursorPos(e);

            if (toolType === 'hline') {
                redraw();
                ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = getLineWidth(); ctx.setLineDash([8, 4]);
                ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(canvas.width, p.y); ctx.stroke();
                ctx.restore(); return;
            }
            if (toolType === 'vline') {
                redraw();
                ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = getLineWidth(); ctx.setLineDash([8, 4]);
                ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, canvas.height); ctx.stroke();
                ctx.restore(); return;
            }
            if (toolType === 'rect' && rectStart) {
                redraw();
                const ax = Charts.timeToX(rectStart.time), ay = Charts.priceToY(rectStart.price);
                if (ax == null || ay == null) return;
                ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = getLineWidth(); ctx.setLineDash([8, 4]);
                ctx.strokeRect(ax, ay, p.x - ax, p.y - ay);
                ctx.restore(); return;
            }
            if ((toolType === 'line' || toolType === 'arrow') && startPt) {
                redraw();
                const ax = Charts.timeToX(startPt.time), ay = Charts.priceToY(startPt.price);
                if (ax == null || ay == null) return;
                ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = getLineWidth();
                ctx.shadowColor = color; ctx.shadowBlur = 5; ctx.setLineDash([8, 4]);
                ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(p.x, p.y); ctx.stroke();
                if (toolType === 'arrow') { ctx.setLineDash([]); drawArrowhead(ax, ay, p.x, p.y, color, getLineWidth()); }
                ctx.restore();
            }
        }

        // Resize canvas to match chart container and redraw everything.
        function sync() {
            if (!canvas) return;
            canvas.width  = canvas.parentElement.offsetWidth;
            canvas.height = canvas.parentElement.offsetHeight;
            redraw();
        }

        // Save current lines to per-coin store.
        function saveCoin(coinId) {
            if (coinId) _coinDrawings[coinId] = lines.slice();
        }

        // Load per-coin drawings and subscribe to chart scroll so drawings track movement.
        function loadCoin(coinId) {
            _currentCoin = coinId;
            lines = (_coinDrawings[coinId] || []).slice();
            Charts.onScrollRedraw(redraw); // subscribe to new chart instance's scroll/zoom
            sync();
        }

        function init() {
            canvas = document.getElementById('trendCanvas');
            if (!canvas) return;
            ctx = canvas.getContext('2d');
            canvas.addEventListener('click',     onClick);
            canvas.addEventListener('mousemove', onMove);
            new ResizeObserver(sync).observe(canvas.parentElement);
            sync();
        }

        function toggle() {
            active = !active;
            startPt = null; rectStart = null;
            canvas.style.pointerEvents = active ? 'auto' : 'none';
            canvas.style.cursor        = active ? 'crosshair' : '';
            setStatus(active ? 'Click to draw...' : '');
            return active;
        }

        // Deactivate draw mode without clearing drawings (used on coin/timeframe switch).
        function deactivate() {
            active = false; startPt = null; rectStart = null;
            if (canvas) { canvas.style.pointerEvents = 'none'; canvas.style.cursor = ''; }
            setStatus('');
        }

        function setColor(c) { color = c; }
        function setTool(t)  { toolType = t; startPt = null; rectStart = null; }

        function undo() { lines.pop(); if (_currentCoin) _coinDrawings[_currentCoin] = lines.slice(); redraw(); }

        function clear() {
            lines = []; startPt = null; rectStart = null; active = false;
            if (_currentCoin) _coinDrawings[_currentCoin] = [];
            if (canvas) {
                canvas.style.pointerEvents = 'none'; canvas.style.cursor = '';
                ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            setStatus('');
        }

        function isActive() { return active; }

        return { init, toggle, isActive, setColor, setTool, undo, clear, sync, saveCoin, loadCoin, deactivate };
    })();

    // ── Event Bindings ───────────────────────────────────────────────────────
    function bindEvents() {
        // Theme
        document.getElementById('themeToggle').addEventListener('click', Theme.toggle);

        // Search
        document.getElementById('searchBtn').addEventListener('click', handleSearch);
        document.getElementById('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });

        // Keyboard shortcut: "/" or Ctrl+K focuses search
        document.addEventListener('keydown', e => {
            if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement !== document.getElementById('searchInput')) {
                e.preventDefault();
                document.getElementById('searchInput').focus();
            }
            if (e.key === 'Escape') {
                document.getElementById('searchInput').blur();
                const sugEl = document.getElementById('searchSuggestions');
                if (sugEl) sugEl.style.display = 'none';
            }
        });

        const searchInput  = document.getElementById('searchInput');
        const suggestionsEl = document.getElementById('searchSuggestions');

        searchInput?.addEventListener('focus', () => {
            document.getElementById('searchBarWrap')?.classList.add('focused');
            const kbd = document.getElementById('searchKbd');
            if (kbd) kbd.style.display = 'none';
        });
        searchInput?.addEventListener('blur', () => {
            setTimeout(() => {
                document.getElementById('searchBarWrap')?.classList.remove('focused');
                if (suggestionsEl) suggestionsEl.style.display = 'none';
                const kbd = document.getElementById('searchKbd');
                if (kbd) kbd.style.display = '';
            }, 200);
        });
        searchInput?.addEventListener('input', () => {
            const q = searchInput.value.trim().toLowerCase();
            if (!q || q.length < 1) { if (suggestionsEl) suggestionsEl.style.display = 'none'; return; }
            const hits = COIN_LIST.filter(c =>
                c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
            ).slice(0, 6);
            if (!hits.length || !suggestionsEl) { if (suggestionsEl) suggestionsEl.style.display = 'none'; return; }
            suggestionsEl.innerHTML = hits.map(c => `
                <div class="search-suggestion-item" data-id="${c.id}">
                    <span class="ssi-symbol">${c.symbol}</span>
                    <span class="ssi-name">${c.name}</span>
                </div>`).join('');
            suggestionsEl.style.display = 'block';
            suggestionsEl.querySelectorAll('.search-suggestion-item').forEach(item => {
                item.addEventListener('mousedown', () => {
                    window.showCoinDetail(item.dataset.id);
                    searchInput.value = '';
                    suggestionsEl.style.display = 'none';
                });
            });
        });

        // Chart controls
        document.getElementById('chartCoinSelect').addEventListener('change', loadChart);

        // ── Indicator Panel ───────────────────────────────────────────────────
        const _indPanel = document.getElementById('indPanel');
        const _indBtn   = document.getElementById('indBtn');

        function _posIndPanel() {
            const r = _indBtn.getBoundingClientRect();
            _indPanel.style.top   = (r.bottom + 6) + 'px';
            _indPanel.style.right = (window.innerWidth - r.right) + 'px';
            _indPanel.style.left  = 'auto';
        }
        function _openInd()  { _posIndPanel(); _indPanel.style.display = 'block'; _indBtn.classList.add('open'); }
        function _closeInd() { _indPanel.style.display = 'none'; _indBtn.classList.remove('open'); }

        _indBtn.addEventListener('click', e => {
            e.stopPropagation();
            _indPanel.style.display === 'block' ? _closeInd() : _openInd();
        });
        document.getElementById('indCloseBtn').addEventListener('click', _closeInd);
        document.addEventListener('click', e => {
            if (!_indPanel.contains(e.target) && e.target !== _indBtn) _closeInd();
        });
        window.addEventListener('scroll', () => {
            if (_indPanel.style.display === 'block') _posIndPanel();
        }, { passive: true });

        function _syncIndicators() {
            Charts.applyIndicators({
                sma20: document.getElementById('indSma20').checked,
                sma50: document.getElementById('indSma50').checked,
                ema12: document.getElementById('indEma12').checked,
                ema26: document.getElementById('indEma26').checked,
                bb:    document.getElementById('indBB').checked,
                vwap:  document.getElementById('indVWAP').checked,
            });
        }

        document.querySelectorAll('.cv-ind-check').forEach(cb => {
            cb.addEventListener('change', () => {
                cb.closest('.cv-ind-row').classList.toggle('active', cb.checked);
                _syncIndicators();
            });
        });

        // Sub-chart chips in indicator panel → click corresponding tab
        document.querySelectorAll('.cv-ind-sub-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelector(`.cv-sub-tab[data-sub="${chip.dataset.sub}"]`)?.click();
            });
        });

        document.querySelectorAll('#timeframeBtns button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#timeframeBtns button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentDays = parseInt(btn.dataset.days);
                loadChart();
            });
        });

        document.getElementById('lineChartBtn').addEventListener('click', () => {
            currentChartType = 'line';
            document.getElementById('lineChartBtn').classList.add('active');
            document.getElementById('candleChartBtn').classList.remove('active');
            loadChart();
        });
        document.getElementById('candleChartBtn').addEventListener('click', () => {
            currentChartType = 'candlestick';
            document.getElementById('candleChartBtn').classList.add('active');
            document.getElementById('lineChartBtn').classList.remove('active');
            loadChart();
        });

        // Prediction
        document.getElementById('runPredictionBtn').addEventListener('click', runPrediction);

        // Portfolio – add/update
        document.getElementById('addHoldingBtn').addEventListener('click', () => {
            const coinId   = document.getElementById('portfolioCoinSelect').value;
            const qty      = document.getElementById('portfolioQty').value;
            const buyPrice = document.getElementById('portfolioBuyPrice').value;
            const buyDate  = document.getElementById('portfolioBuyDate').value;
            const errEl    = document.getElementById('portfolioError');

            if (!qty || parseFloat(qty) <= 0) { errEl.textContent = 'Please enter a valid quantity.'; return; }
            if (!buyPrice || parseFloat(buyPrice) <= 0) { errEl.textContent = 'Please enter a valid buy price.'; return; }
            errEl.textContent = '';

            if (editingId) {
                Portfolio.update(editingId, qty, buyPrice, buyDate);
                toast('Holding updated!', 'success');
                resetPortfolioForm();
            } else {
                const meta = COIN_LIST.find(c => c.id === coinId);
                Portfolio.add(coinId, meta?.name, meta?.symbol, qty, buyPrice, buyDate);
                toast('Holding added!', 'success');
                document.getElementById('portfolioQty').value = '';
                document.getElementById('portfolioBuyPrice').value = '';
            }
            refreshPortfolio();
        });

        // Portfolio – cancel edit
        document.getElementById('cancelEditBtn').addEventListener('click', resetPortfolioForm);

        // Portfolio – clear all
        document.getElementById('clearPortfolioBtn').addEventListener('click', () => {
            if (!Portfolio.getAll().length) { toast('Portfolio is already empty.', 'info'); return; }
            if (confirm('Clear all holdings? This cannot be undone.')) {
                Portfolio.clear();
                resetPortfolioForm();
                refreshPortfolio();
                toast('Portfolio cleared.', 'info');
            }
        });

        // Watchlist
        document.getElementById('addWatchlistBtn').addEventListener('click', () => {
            const sel  = document.getElementById('watchlistCoinSelect');
            const id   = sel.value;
            const name = sel.options[sel.selectedIndex].text.replace(/\s*\(.*\)/, '');
            const sym  = sel.options[sel.selectedIndex].text.match(/\((.+)\)/)?.[1] || id.toUpperCase();
            const added = Watchlist.add(id, name, sym);
            toast(added ? `${name} added to watchlist!` : 'Already in watchlist.', added ? 'success' : 'info');
            if (added) refreshWatchlist();
        });

        document.getElementById('refreshWatchlistBtn').addEventListener('click', refreshWatchlist);

        // Comparison
        document.getElementById('runCompareBtn').addEventListener('click', runComparison);

        // Helper: sync the Draw button UI and panel visibility with TrendDraw active state
        function syncDrawBtn(on) {
            const btn   = document.getElementById('drawTrendBtn');
            const panel = document.getElementById('drawPanel');
            if (!btn) return;
            btn.classList.toggle('active', on);
            btn.innerHTML = on
                ? '<i class="bi bi-pencil-fill"></i> <span>Drawing…</span>'
                : '<i class="bi bi-pencil"></i> <span>Draw</span>';
            if (panel) panel.style.display = on ? '' : 'none';
        }

        // Sub-chart tabs
        const subPanels = { volume: 'subVolume', rsi: 'subRSI', macd: 'subMACD' };
        const subDescs  = {
            volume: 'Total trading volume in USD',
            rsi:    'Relative Strength Index (14) · Below 30 = Oversold · Above 70 = Overbought',
            macd:   'MACD (12,26,9) · Above signal line = Bullish · Below = Bearish',
        };
        document.querySelectorAll('.cv-sub-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.cv-sub-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.cv-sub-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const key = tab.dataset.sub;
                const panelId = subPanels[key];
                if (panelId) document.getElementById(panelId)?.classList.add('active');
                const descEl = document.getElementById('subTabDesc');
                if (descEl && subDescs[key]) descEl.textContent = subDescs[key];
                // Lazy-render on first tab visit
                if (key === 'rsi'  && lastTs.length) Charts.renderRSIChart(lastTs, lastRSI);
                if (key === 'macd' && lastTs.length) Charts.renderMACDChart(lastTs, lastMACD);
                // Sync sub-chart chips in indicator panel
                document.querySelectorAll('.cv-ind-sub-chip').forEach(c => {
                    c.classList.toggle('active', c.dataset.sub === key);
                });
            });
        });

        // Drawing tools — tool selector (also activates draw mode automatically)
        document.querySelectorAll('.draw-tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.draw-tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                TrendDraw.setTool(btn.dataset.tool);
                // Auto-activate drawing if not already on
                if (!TrendDraw.isActive()) {
                    TrendDraw.toggle();
                    syncDrawBtn(true);
                }
            });
        });

        // Zoom in / out
        document.getElementById('zoomInBtn').addEventListener('click',  () => Charts.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => Charts.zoomOut());

        // Download chart as PNG
        document.getElementById('downloadChartBtn').addEventListener('click', () => {
            const coinMeta  = COIN_LIST.find(c => c.id === currentCoin);
            const tfLabel   = document.querySelector('#timeframeBtns button.active')?.textContent?.trim() || '1M';
            const activeSub = document.querySelector('.cv-sub-tab.active')?.dataset.sub || 'volume';
            Charts.downloadChart(
                coinMeta?.name   || currentCoin,
                coinMeta?.symbol || currentCoin.toUpperCase(),
                tfLabel,
                activeSub,
            );
        });

        // Trend line drawing — manual draw toggle
        document.getElementById('drawTrendBtn').addEventListener('click', () => {
            const on = TrendDraw.toggle();
            syncDrawBtn(on);
        });

        // Undo
        document.getElementById('undoTrendBtn')?.addEventListener('click', () => TrendDraw.undo());

        // Color buttons
        document.querySelectorAll('.trend-color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.trend-color-btn').forEach(b => b.style.border = '2px solid transparent');
                btn.style.border = '2px solid white';
                TrendDraw.setColor(btn.dataset.color);
            });
        });

        // Clear
        document.getElementById('clearTrendBtn').addEventListener('click', () => {
            TrendDraw.clear();
            syncDrawBtn(false);
        });

        // Annotations
        document.getElementById('addAnnotationBtn').addEventListener('click', () => {
            const date  = document.getElementById('annotationDate').value;
            const type  = document.getElementById('annotationType').value;
            const note  = document.getElementById('annotationNote').value.trim();
            const price = document.getElementById('annotationPrice').value;
            if (!date && !price) { toast('Enter a date or price level.', 'warning'); return; }
            Charts.addAnnotation({ date, type, note, price: price ? parseFloat(price) : null });
            renderAnnotationList();
            if (document.getElementById('charts').classList.contains('show')) loadChart();
            document.getElementById('annotationDate').value  = '';
            document.getElementById('annotationNote').value  = '';
            document.getElementById('annotationPrice').value = '';
            toast('Annotation added!', 'success');
        });

        // Sidebar collapse toggle
        const sidebarBtn = document.getElementById('sidebarCollapseBtn');
        const sidebar    = document.getElementById('cvSidebar');
        const mainArea   = document.getElementById('mainArea');
        if (sidebarBtn && sidebar && mainArea) {
            sidebarBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                mainArea.classList.toggle('sidebar-collapsed');
                sidebarBtn.querySelector('i').className = sidebar.classList.contains('collapsed')
                    ? 'bi bi-layout-sidebar' : 'bi bi-layout-sidebar-reverse';
            });
        }

        // Sentiment panel collapse toggle
        const saHeader = document.getElementById('saCardHeader');
        if (saHeader) {
            saHeader.addEventListener('click', () => {
                const body  = saHeader.nextElementSibling;
                const icon  = document.getElementById('saToggleIcon');
                const btn   = document.getElementById('saToggleBtn');
                if (!body) return;
                const isCollapsed = body.style.display === 'none';
                body.style.display = isCollapsed ? '' : 'none';
                if (icon) icon.className = isCollapsed ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
                if (btn)  btn.classList.toggle('active', !isCollapsed);
            });
            document.getElementById('saToggleBtn')?.addEventListener('click', e => {
                e.stopPropagation();
                saHeader.click();
            });
        }

        // Sidebar navigation — manual tab switching (bypasses Bootstrap's .nav requirement)
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const href = link.getAttribute('href');
                const pane = document.querySelector(href);
                if (!pane) return;

                // Deactivate all tab panes, activate target
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('show', 'active'));
                pane.classList.add('active'); // display:block, opacity:0
                requestAnimationFrame(() => pane.classList.add('show')); // triggers fade+slide transition

                // Update sidebar active state
                document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Instant scroll — better perceived performance than smooth scroll on navigation
                window.scrollTo({ top: 0 });

                // Tab-specific actions
                if (href !== '#charts') WS.disconnect();
                if (href === '#portfolio') refreshPortfolio();
                if (href === '#watchlist') refreshWatchlist();
                if (href === '#charts') loadChart(); // always refresh + reconnect WS
                if (href === '#market') loadMarket();
            });
        });
    }

    // ── Market Page ───────────────────────────────────────────────────────────
    let mktAllCoins    = [];
    let mktCatFilter   = 'all';
    let mktSortKey     = 'rank';
    let mktQuery       = '';
    let mktLoaded      = false;

    const COIN_CATS = {
        'bitcoin':'Layer 1','ethereum':'Layer 1','binancecoin':'Layer 1',
        'solana':'Layer 1','cardano':'Layer 1','avalanche-2':'Layer 1',
        'polkadot':'Layer 1','near':'Layer 1','cosmos':'Layer 1',
        'algorand':'Layer 1','stellar':'Layer 1','tron':'Layer 1',
        'fantom':'Layer 1','hedera-hashgraph':'Layer 1','internet-computer':'Layer 1',
        'ethereum-classic':'Layer 1','aptos':'Layer 1','sui':'Layer 1',
        'litecoin':'Layer 1','bitcoin-cash':'Layer 1','vechain':'Layer 1',
        'kaspa':'Layer 1','toncoin':'Layer 1','monero':'Layer 1',
        'arbitrum':'Layer 2','optimism':'Layer 2','matic-network':'Layer 2',
        'stacks':'Layer 2','mantle':'Layer 2',
        'uniswap':'DeFi','aave':'DeFi','maker':'DeFi','curve-dao-token':'DeFi',
        'lido-dao':'DeFi','the-graph':'DeFi','chainlink':'DeFi',
        'injective-protocol':'DeFi','fetch-ai':'DeFi','render-token':'DeFi',
        'sei-network':'DeFi','ripple':'DeFi',
        'the-sandbox':'Gaming','decentraland':'Gaming','axie-infinity':'Gaming',
        'worldcoin-wld':'Gaming',
        'dogecoin':'Meme','shiba-inu':'Meme','pepe':'Meme','floki':'Meme',
    };
    const CAT_CSS = {
        'Layer 1':'mkt-cat-l1','Layer 2':'mkt-cat-l2',
        'DeFi':'mkt-cat-defi','Gaming':'mkt-cat-game','Meme':'mkt-cat-meme',
    };

    function mktPctEl(v) {
        if (v == null || isNaN(v)) return '<span class="mkt-neutral">—</span>';
        const cls = v > 0 ? 'mkt-up' : v < 0 ? 'mkt-down' : 'mkt-neutral';
        return `<span class="${cls}">${v >= 0 ? '+' : ''}${v.toFixed(2)}%</span>`;
    }

    function renderHeatmap(coins) {
        const top = [...coins]
            .filter(c => c.market_cap > 0)
            .sort((a, b) => b.market_cap - a.market_cap)
            .slice(0, 50);

        const el = document.getElementById('mktHeatmap');
        if (!el) return;

        function tileBg(pct) {
            if (pct >= 5)    return '#065f46';
            if (pct >= 2)    return '#047857';
            if (pct >= 0.5)  return '#059669';
            if (pct >= 0)    return '#134d3a';
            if (pct >= -0.5) return '#3b1f1f';
            if (pct >= -2)   return '#7f1d1d';
            if (pct >= -5)   return '#991b1b';
            return '#b91c1c';
        }

        function tileSpan(rank) {
            if (rank <= 2)  return { span: 4, cls: 'mkt-htile-xl' };
            if (rank <= 5)  return { span: 3, cls: 'mkt-htile-lg' };
            if (rank <= 14) return { span: 2, cls: 'mkt-htile-md' };
            return { span: 1, cls: '' };
        }

        const grid = document.createElement('div');
        grid.className = 'mkt-heatmap-grid';

        top.forEach((c, i) => {
            const pct    = c.price_change_percentage_24h || 0;
            const { span, cls } = tileSpan(c.rank);
            const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';

            const tile = document.createElement('div');
            tile.className = `mkt-htile ${cls}`;
            tile.style.cssText = `background:${tileBg(pct)};grid-column:span ${span};animation-delay:${i * 0.035}s`;
            tile.innerHTML = `<span class="mht-sym">${c.symbol.toUpperCase()}</span><span class="mht-pct">${pctStr}</span>`;
            tile.title = `${c.name} · ${pctStr} · ${fmt.usd(c.current_price)}`;
            tile.addEventListener('click', () => window.viewChart(c.id));
            grid.appendChild(tile);
        });

        el.innerHTML = '';
        el.appendChild(grid);
    }

    function renderPulse(coins) {
        const gainers  = coins.filter(c => (c.price_change_percentage_24h || 0) > 0.05).length;
        const losers   = coins.filter(c => (c.price_change_percentage_24h || 0) < -0.05).length;
        const flat     = coins.length - gainers - losers;
        const avgChange = coins.reduce((s, c) => s + (c.price_change_percentage_24h || 0), 0) / coins.length;
        const totalVol  = coins.reduce((s, c) => s + (c.total_volume || 0), 0);

        const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setEl('mktPulseGainers', gainers);
        setEl('mktPulseLosers',  losers);
        setEl('mktPulseFlat',    flat);

        const avgEl = document.getElementById('mktPulseAvg');
        if (avgEl) {
            avgEl.textContent = (avgChange >= 0 ? '+' : '') + avgChange.toFixed(2) + '%';
            avgEl.className = 'mkt-pulse-value ' + (avgChange >= 0 ? 'up' : 'down');
        }
        setEl('mktPulseVol', fmt.usd(totalVol));

        const total = gainers + losers + flat || 1;
        const gBar = document.getElementById('mktPulseGainersBar');
        const lBar = document.getElementById('mktPulseLosersBar1');
        const fBar = document.getElementById('mktPulseFlatBar1');
        if (gBar) gBar.style.width = (gainers / total * 100).toFixed(1) + '%';
        if (lBar) lBar.style.width = (losers  / total * 100).toFixed(1) + '%';
        if (fBar) fBar.style.width = (flat    / total * 100).toFixed(1) + '%';
    }

    function renderMarketTable() {
        let coins = [...mktAllCoins];

        if (mktQuery) {
            const q = mktQuery.toLowerCase();
            coins = coins.filter(c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
        }
        if (mktCatFilter !== 'all') {
            coins = coins.filter(c => (COIN_CATS[c.id] || 'Other') === mktCatFilter);
        }

        const sortMap = {
            rank:         (a, b) => a.rank - b.rank,
            price_desc:   (a, b) => b.current_price - a.current_price,
            price_asc:    (a, b) => a.current_price - b.current_price,
            change24_desc:(a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0),
            change24_asc: (a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0),
            mcap_desc:    (a, b) => b.market_cap - a.market_cap,
            vol_desc:     (a, b) => b.total_volume - a.total_volume,
        };
        if (sortMap[mktSortKey]) coins.sort(sortMap[mktSortKey]);

        const tbody = document.getElementById('mktTableBody');
        if (!coins.length) {
            tbody.innerHTML = `<tr><td colspan="8" class="mkt-empty"><i class="bi bi-search" style="font-size:1.4rem;opacity:.25;display:block;margin-bottom:6px"></i>No coins match your filter</td></tr>`;
            return;
        }

        tbody.innerHTML = coins.map(c => {
            const ch24 = c.price_change_percentage_24h || 0;
            const ch7d = c.price_change_percentage_7d_in_currency || 0;
            const cat  = COIN_CATS[c.id] || 'Other';
            const catCls = CAT_CSS[cat] || 'mkt-cat-other';
            return `<tr onclick="window.viewChart('${c.id}')">
                <td class="mkt-rank">${c.rank}</td>
                <td><div class="mkt-coin-cell">
                    <img src="${c.image}" width="24" height="24" style="border-radius:50%;flex-shrink:0" onerror="coinImgFallback(this,'${c.symbol}')">
                    <div><div class="mkt-coin-name">${c.name}</div><div class="mkt-coin-sym">${c.symbol.toUpperCase()}</div></div>
                </div></td>
                <td class="mkt-price">${fmt.usd(c.current_price)}</td>
                <td>${mktPctEl(ch24)}</td>
                <td class="hide-sm">${mktPctEl(ch7d)}</td>
                <td class="mkt-mcap hide-sm">${fmt.usd(c.market_cap)}</td>
                <td class="mkt-vol hide-sm">${fmt.usd(c.total_volume)}</td>
                <td class="hide-sm"><span class="mkt-cat-badge ${catCls}">${cat}</span></td>
            </tr>`;
        }).join('');
    }

    async function loadMarket() {
        if (!mktLoaded) {
            mktLoaded = true;
            document.getElementById('mktSearch').addEventListener('input', e => {
                mktQuery = e.target.value.trim();
                renderMarketTable();
            });
            document.querySelectorAll('[data-mkt-cat]').forEach(btn => {
                btn.addEventListener('click', () => {
                    mktCatFilter = btn.dataset.mktCat;
                    document.querySelectorAll('[data-mkt-cat]').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderMarketTable();
                });
            });
            document.getElementById('mktSort').addEventListener('change', e => {
                mktSortKey = e.target.value;
                renderMarketTable();
            });
        }

        if (mktAllCoins.length) {
            renderHeatmap(mktAllCoins);
            renderPulse(mktAllCoins);
            renderMarketTable();
            return;
        }

        try {
            const markets = await API.getMarkets(1, 100);
            mktAllCoins = markets;

            // Sync COIN_LIST to live top-100 so all dropdowns reflect current market
            COIN_LIST.length = 0;
            markets.forEach(m => COIN_LIST.push({ id: m.id, name: m.name, symbol: m.symbol.toUpperCase() }));
            populateCoinSelects();
            document.querySelectorAll(
                '#chartCoinSelect,#predCoinSelect,#portfolioCoinSelect,#watchlistCoinSelect,#cmpCoin1,#cmpCoin2,#cmpCoin3'
            ).forEach(el => el._customSelect?.refresh());

            renderHeatmap(markets);
            renderPulse(markets);
            renderMarketTable();
        } catch (err) {
            document.getElementById('mktTableBody').innerHTML =
                `<tr><td colspan="8" class="mkt-empty" style="color:var(--red)"><i class="bi bi-exclamation-triangle"></i> Failed to load market data</td></tr>`;
        }
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    async function init() {
        Theme.init();
        coinDetailModal = new bootstrap.Modal(document.getElementById('coinDetailModal'));

        populateCoinSelects();
        initCustomSelects();
        bindEvents();
        TrendDraw.init();

        // Warm remaining coins in background after dashboard settles
        // Popular coins are already warming via _preloadNext() at IIFE start.
        const top  = _popularCoins;
        const rest = COIN_LIST.map(c => c.id).filter(id => !top.includes(id));
        let ri = 0;
        const warmRest = () => {
            if (ri >= rest.length) return;
            API.getMarketChart(rest[ri++], 30).catch(() => {});
            setTimeout(warmRest, 200); // slower for non-popular coins
        };
        setTimeout(warmRest, 5000);

        // Default dates
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('annotationDate').value   = today;
        document.getElementById('portfolioBuyDate').value = today;

        // Pre-render all tabs while the page loader covers the screen.
        // The loader guarantees ≥2s of cover. By the time it fades, every tab is ready.

        // Charts: force-display so ApexCharts can measure real dimensions inside the hidden pane
        const chartPane = document.getElementById('charts');
        if (chartPane) {
            chartPane.style.setProperty('display', 'block', 'important');
            loadChart().catch(() => {}).finally(() => {
                if (!chartPane.classList.contains('active')) chartPane.style.removeProperty('display');
            });
        }

        // Market, Portfolio, Watchlist: pure DOM — safe to render while hidden
        loadMarket().catch(() => {});
        refreshPortfolio().catch(() => {});
        refreshWatchlist().catch(() => {});

        // Run dashboard load and a minimum display timer in parallel
        const minShow = new Promise(r => setTimeout(r, 2000));
        await Promise.all([loadDashboard(), minShow]);
        setInterval(loadDashboard, 60_000);

        // Hide page loader — fade-out takes 1.2s (CSS transition)
        const loader = document.getElementById('pageLoader');
        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => loader.remove(), 1300);
        }

        // Scroll-to-top button
        const scrollBtn = document.getElementById('scrollTopBtn');
        if (scrollBtn) {
            window.addEventListener('scroll', () => {
                scrollBtn.classList.toggle('show', window.scrollY > 350);
            }, { passive: true });
            scrollBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        // Scroll-triggered reveal (IntersectionObserver)
        const revealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

        document.querySelectorAll('.reveal-on-scroll').forEach(el => revealObserver.observe(el));

    }

    init();
})();
