/**
 * charts.js
 * Main / Volume / RSI / MACD  →  TradingView Lightweight Charts (TVLWC)
 *   • O(1) incremental WebSocket updates via series.update()
 *   • Synchronised time-scale scrolling across sub-charts
 * Prediction / Allocation / Comparison / Sentiment  →  ApexCharts (retained)
 */
const Charts = (() => {

    // ── TVLWC instances ──────────────────────────────────────────────────────
    let mainChart      = null;
    let mainPriceSer   = null;   // area or candlestick
    let _smaSer20 = null, _smaSer50 = null;
    let _emaSer12 = null, _emaSer26 = null;
    let _bbSerUp  = null, _bbSerLo  = null, _bbSerMid = null;
    let _vwapSer  = null;
    let mainPriceLines = [];

    let volumeChart  = null;
    let volumeSer    = null;

    let rsiChart   = null;
    let rsiSer     = null;
    let rsiAnchor  = null;   // invisible anchor series to fix 0-100 scale

    let macdChart  = null;
    let macdLine   = null;
    let macdSig    = null;
    let macdHist   = null;

    // ── ApexCharts instances (retained for non-main charts) ──────────────────
    let predChart      = null;
    let allocChart     = null;
    let compareChart   = null;
    let sentHistChart  = null;

    // ── Live-update state (kept in sync for incremental WS updates) ──────────
    let _type   = 'line';
    let _ts     = [];   // Unix seconds
    let _prices = [];   // close prices
    let _ohlc   = [];   // {time(s), open, high, low, close}
    let _vols   = [];
    let _indicators = { sma20: true, sma50: true, ema12: false, ema26: false, bb: false, vwap: false };

    // ── Annotations ──────────────────────────────────────────────────────────
    const annotations = [];

    // ── ResizeObserver (one shared instance) ─────────────────────────────────
    const _ro = new ResizeObserver(() => {
        _rz(mainChart,   'mainChart');
        _rz(volumeChart, 'volumeChart');
        _rz(rsiChart,    'rsiChart');
        _rz(macdChart,   'macdChart');
    });
    function _rz(chart, id) {
        if (!chart) return;
        const el = document.getElementById(id);
        if (el) chart.applyOptions({ width: el.clientWidth });
    }
    ['mainChart','volumeChart','rsiChart','macdChart'].forEach(id => {
        const el = document.getElementById(id);
        if (el) _ro.observe(el);
    });

    // ── TVLWC dark theme ─────────────────────────────────────────────────────
    const TV = {
        layout:  { background: { type: 'solid', color: 'transparent' }, textColor: '#64748b', fontFamily: "'Oxanium', sans-serif", fontSize: 12 },
        grid:    { vertLines: { color: '#1e293b', style: 1 }, horzLines: { color: '#1e293b', style: 1 } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: '#1e293b' },
        timeScale: { borderColor: '#1e293b', timeVisible: true, secondsVisible: false },
        handleScroll: true,
        handleScale:  true,
    };

    // ── Responsive height helpers ─────────────────────────────────────────────
    const _isMobile  = () => window.innerWidth < 768;
    const _mainH     = () => _isMobile() ? 260 : 400;
    const _subVolH   = () => _isMobile() ? 120 : 180;
    const _subIndH   = () => _isMobile() ? 140 : 200;

    // Resize all active charts when viewport changes (e.g. orientation flip)
    let _resizeTid = null;
    window.addEventListener('resize', () => {
        clearTimeout(_resizeTid);
        _resizeTid = setTimeout(() => {
            if (mainChart)   mainChart.applyOptions({ height: _mainH() });
            if (volumeChart) volumeChart.applyOptions({ height: _subVolH() });
            if (rsiChart)    rsiChart.applyOptions({ height: _subIndH() });
            if (macdChart)   macdChart.applyOptions({ height: _subIndH() });
        }, 150);
    });

    // ── Helpers ───────────────────────────────────────────────────────────────
    const toSec = ms => Math.floor(ms / 1000);

    function rmTV(c)    { if (c) try { c.remove();   } catch (_) {} }
    function rmApex(c)  { if (c) try { c.destroy();  } catch (_) {} }

    function _animateChart(el, sub = false) {
        const dur    = sub ? 0.45 : 0.6;
        const easing = 'cubic-bezier(0.16, 1, 0.3, 1)';

        // Start: blurred, scaled down, faded out — like camera out of focus
        el.style.transition = 'none';
        el.style.opacity    = '0';
        el.style.transform  = sub ? 'scale(0.97) translateY(10px)' : 'scale(0.93) translateY(20px)';
        el.style.filter     = sub ? 'blur(4px)' : 'blur(8px)';

        // Double rAF ensures hidden state is committed to GPU before transition starts
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.style.transition = [
                    `opacity ${dur}s ${easing}`,
                    `transform ${dur}s ${easing}`,
                    `filter ${dur}s ${easing}`,
                ].join(', ');
                el.style.opacity   = '1';
                el.style.transform = 'scale(1) translateY(0)';
                el.style.filter    = 'blur(0px)';
                setTimeout(() => {
                    el.style.transition = '';
                    el.style.transform  = '';
                    el.style.filter     = '';
                }, dur * 1000 + 80);
            });
        });
    }

    function priceFmt(p) {
        if (p == null) return '';
        if (p >= 1e9) return '$' + (p / 1e9).toFixed(2) + 'B';
        if (p >= 1e6) return '$' + (p / 1e6).toFixed(2) + 'M';
        if (p >= 1e3) return '$' + p.toLocaleString(undefined, { maximumFractionDigits: 2 });
        return '$' + p.toFixed(p < 1 ? 6 : 2);
    }
    function volFmt(v) {
        if (!v) return '0';
        if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
        if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
        if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
        return '$' + v.toFixed(0);
    }

    // ── Overlay helpers ───────────────────────────────────────────────────────
    function _clearOverlays() {
        [_smaSer20, _smaSer50, _emaSer12, _emaSer26, _bbSerUp, _bbSerLo, _bbSerMid, _vwapSer]
            .forEach(s => { if (s) try { mainChart.removeSeries(s); } catch (_) {} });
        _smaSer20 = _smaSer50 = _emaSer12 = _emaSer26 = null;
        _bbSerUp  = _bbSerLo  = _bbSerMid = _vwapSer  = null;
    }

    function _buildOverlays() {
        if (!mainChart) return;
        _clearOverlays();

        const closes = _type === 'candlestick' ? _ohlc.map(d => d.close) : _prices;
        const ts     = _type === 'candlestick' ? _ohlc.map(d => d.time)  : _ts;
        const n      = closes.length;

        const addLine = (vals, tArr, color, width = 1.5, style = 0) => {
            const s = mainChart.addLineSeries({ color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false });
            s.setData(tArr.map((t, i) => vals[i] != null ? { time: t, value: vals[i] } : null).filter(Boolean));
            return s;
        };

        if (_indicators.sma20 && n >= 20)
            _smaSer20 = addLine(Indicators.sma(closes, 20), ts, '#f59e0b');
        if (_indicators.sma50 && n >= 50)
            _smaSer50 = addLine(Indicators.sma(closes, 50), ts, '#8b5cf6');
        if (_indicators.ema12 && n >= 12)
            _emaSer12 = addLine(Indicators.ema(closes, 12), ts, '#22d3ee');
        if (_indicators.ema26 && n >= 26)
            _emaSer26 = addLine(Indicators.ema(closes, 26), ts, '#f43f5e');
        if (_indicators.bb && n >= 20) {
            const bb = Indicators.bollingerBands(closes, 20);
            _bbSerUp  = addLine(bb.map(b => b?.upper),  ts, 'rgba(239,68,68,0.55)', 1, 2);
            _bbSerLo  = addLine(bb.map(b => b?.lower),  ts, 'rgba(239,68,68,0.55)', 1, 2);
            _bbSerMid = addLine(bb.map(b => b?.middle), ts, 'rgba(239,68,68,0.25)', 1);
        }
        if (_indicators.vwap && _type === 'candlestick' && _ohlc.length > 0 && _vols.length > 0) {
            _vwapSer = addLine(Indicators.vwap(_ohlc, _vols), _ohlc.map(d => d.time), '#10b981');
        }
    }

    function applyIndicators(config) {
        Object.assign(_indicators, config);
        _buildOverlays();
    }

    function _applyAnnotations() {
        mainPriceLines.forEach(pl => { try { mainPriceSer?.removePriceLine(pl); } catch (_) {} });
        mainPriceLines = [];
        if (!mainPriceSer) return;

        annotations.forEach(a => {
            if (!a.price) return;
            const color = a.type === 'support' ? '#10b981' : a.type === 'resistance' ? '#ef4444' :
                          a.type === 'buy'     ? '#10b981' : a.type === 'sell'       ? '#ef4444' : '#f59e0b';
            const pl = mainPriceSer.createPriceLine({
                price: a.price, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true,
                title: a.type.toUpperCase() + (a.note ? ' · ' + a.note : ''),
            });
            mainPriceLines.push(pl);
        });

        const markers = annotations
            .filter(a => a.date)
            .map(a => ({
                time: toSec(new Date(a.date).getTime()),
                position: a.type === 'sell' ? 'aboveBar' : 'belowBar',
                color:    a.type === 'buy' ? '#10b981' : a.type === 'sell' ? '#ef4444' : '#f59e0b',
                shape:    a.type === 'buy' ? 'arrowUp' : a.type === 'sell' ? 'arrowDown' : 'circle',
                text:     a.type.toUpperCase() + (a.note ? ' · ' + a.note : ''),
            }))
            .sort((a, b) => a.time - b.time);
        if (markers.length) try { mainPriceSer.setMarkers(markers); } catch (_) {}
    }

    // ── Crosshair tooltip ─────────────────────────────────────────────────────
    const _ttEl = document.getElementById('chartTooltip');
    let _ttVisible = false;

    function _fmtPrice(v) {
        if (v == null || isNaN(v)) return '—';
        if (v >= 1e4) return '$' + v.toLocaleString(undefined, { maximumFractionDigits: 2 });
        if (v >= 1)   return '$' + v.toFixed(2);
        return '$' + v.toPrecision(4);
    }
    function _fmtDate(unixSec) {
        const d = new Date(unixSec * 1000);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
             + '  ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    function _row(label, value, cls = '') {
        return `<div class="tt-row"><span class="tt-label">${label}</span><span class="tt-val${cls ? ' ' + cls : ''}">${value}</span></div>`;
    }

    function _setupCrosshairTooltip() {
        if (!mainChart || !_ttEl) return;
        mainChart.subscribeCrosshairMove(param => {
            // Hide when cursor leaves the chart area
            if (!param.point || !param.seriesData || !param.seriesData.size) {
                if (_ttVisible) { _ttEl.classList.remove('visible'); _ttVisible = false; }
                return;
            }

            const data = param.seriesData.get(mainPriceSer);
            if (!data) {
                if (_ttVisible) { _ttEl.classList.remove('visible'); _ttVisible = false; }
                return;
            }

            // Build HTML
            let html = `<div class="tt-date">${_fmtDate(param.time)}</div>`;

            if (_type === 'candlestick') {
                const pct = data.open ? ((data.close - data.open) / data.open * 100) : 0;
                const pctCls = pct >= 0 ? 'up' : 'dn';
                const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
                html += _row('Open',  _fmtPrice(data.open));
                html += _row('High',  _fmtPrice(data.high),  'hi');
                html += _row('Low',   _fmtPrice(data.low),   'lo');
                html += _row('Close', _fmtPrice(data.close));
                html += `<hr class="tt-divider">`;
                html += _row('Change', pctStr, pctCls);
            } else {
                const val = data.value ?? data.close;
                // find prev price for % change
                const idx = _ts.indexOf(param.time);
                const prev = idx > 0 ? _prices[idx - 1] : null;
                const pct = prev ? ((val - prev) / prev * 100) : null;
                const pctCls = pct != null ? (pct >= 0 ? 'up' : 'dn') : '';
                const pctStr = pct != null ? ((pct >= 0 ? '+' : '') + pct.toFixed(2) + '%') : '—';
                html += _row('Price',  _fmtPrice(val));
                html += `<hr class="tt-divider">`;
                html += _row('Change', pctStr, pctCls);
            }

            // Volume
            const vIdx = _ts.indexOf(param.time);
            if (vIdx >= 0 && _vols[vIdx] != null) {
                const vol = _vols[vIdx];
                const volStr = vol >= 1e9 ? (vol / 1e9).toFixed(2) + 'B'
                             : vol >= 1e6 ? (vol / 1e6).toFixed(2) + 'M'
                             : vol >= 1e3 ? (vol / 1e3).toFixed(2) + 'K'
                             : vol.toFixed(2);
                html += _row('Volume', volStr);
            }

            _ttEl.innerHTML = html;
            _ttEl.style.display = 'block';

            // Smart positioning — keep tooltip inside chart area
            const container = document.getElementById('mainChart');
            const cw = container.clientWidth;
            const ch = container.clientHeight;
            const tw = _ttEl.offsetWidth  || 180;
            const th = _ttEl.offsetHeight || 120;
            const margin = 12;
            let x = param.point.x + margin;
            let y = param.point.y - Math.round(th / 2);

            if (x + tw > cw - margin) x = param.point.x - tw - margin;
            if (x < margin) x = margin;
            if (y < margin) y = margin;
            if (y + th > ch - margin) y = ch - th - margin;

            _ttEl.style.left = x + 'px';
            _ttEl.style.top  = y + 'px';

            if (!_ttVisible) { _ttEl.classList.add('visible'); _ttVisible = true; }
        });
    }

    // Synchronise scrolling/zooming of sub-charts with the main chart
    let _syncing = false;
    function _syncTimescales() {
        if (!mainChart) return;
        mainChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (_syncing || !range) return;
            _syncing = true;
            [volumeChart, rsiChart, macdChart].forEach(c => {
                try { c?.timeScale().setVisibleLogicalRange(range); } catch (_) {}
            });
            _syncing = false;
        });
    }

    // ApexCharts shared dark-theme base (unchanged)
    const base = {
        chart:  { background: 'transparent', foreColor: '#64748b', toolbar: { show: true, tools: { zoom: true, zoomin: true, zoomout: true, pan: true, reset: true, download: true }, autoSelected: 'zoom' }, zoom: { enabled: true }, animations: { enabled: false } },
        theme:  { mode: 'dark' },
        grid:   { borderColor: '#1e293b', strokeDashArray: 3 },
        xaxis:  { axisBorder: { color: '#1e293b' }, axisTicks: { color: '#1e293b' }, labels: { style: { colors: '#64748b', fontSize: '11px' } } },
        yaxis:  { labels: { style: { colors: '#64748b', fontSize: '11px' } } },
        tooltip: { theme: 'dark' },
        dataLabels: { enabled: false },
        legend: { labels: { colors: '#94a3b8' } },
    };
    const usdFormatter = v => {
        if (v == null) return '';
        if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
        if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
        if (v >= 1e3) return '$' + v.toLocaleString(undefined, { maximumFractionDigits: 2 });
        return '$' + v.toFixed(v < 1 ? 6 : 2);
    };

    // ════════════════════════════════════════════════════════════════════════
    //  MAIN PRICE CHART  (TVLWC)
    // ════════════════════════════════════════════════════════════════════════
    function renderMainChart(type, timestamps, prices, ohlcData) {
        const el = document.getElementById('mainChart');
        el.innerHTML = '';

        rmTV(mainChart);
        mainChart = null; mainPriceSer = null;
        mainPriceLines = [];

        // Store state for incremental WS updates
        _type   = type;
        _ts     = timestamps.map(toSec);
        _prices = prices.slice();
        _ohlc   = ohlcData.map(d => ({ time: toSec(+d[0]), open: +d[1], high: +d[2], low: +d[3], close: +d[4] }));
        _vols   = [];

        mainChart = LightweightCharts.createChart(el, {
            ...TV,
            width:  el.clientWidth  || 800,
            height: _mainH(),
            localization: { priceFormatter: priceFmt },
        });

        if (type === 'candlestick') {
            mainPriceSer = mainChart.addCandlestickSeries({
                upColor: '#10b981', downColor: '#ef4444',
                borderUpColor: '#10b981', borderDownColor: '#ef4444',
                wickUpColor: '#10b981', wickDownColor: '#ef4444',
            });
            if (_ohlc.length) mainPriceSer.setData(_ohlc);
        } else {
            mainPriceSer = mainChart.addAreaSeries({
                lineColor: '#3b82f6',
                topColor:  'rgba(59,130,246,0.18)',
                bottomColor: 'rgba(59,130,246,0.01)',
                lineWidth: 2,
                priceLineVisible: false,
            });
            mainPriceSer.setData(_ts.map((t, i) => ({ time: t, value: prices[i] })));
        }

        _buildOverlays();
        _applyAnnotations();
        mainChart.timeScale().fitContent();
        _syncTimescales();
        _setupCrosshairTooltip();
        _animateChart(el.parentElement);   // animate .cv-chart-area, not the TVLWC div

        return Promise.resolve();
    }

    // ════════════════════════════════════════════════════════════════════════
    //  INCREMENTAL BAR UPDATE  (WebSocket kline → O(1), no flicker)
    // ════════════════════════════════════════════════════════════════════════
    function updateMainChartBar(bar, volume) {
        // bar = { time (Unix seconds), open, high, low, close }
        if (!mainPriceSer) return;

        const last = _ts.length - 1;
        const isUpdate = last >= 0 && _ts[last] === bar.time;

        if (isUpdate) {
            _prices[last] = bar.close;
            if (_ohlc.length) _ohlc[last] = { time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close };
            if (volume != null && _vols.length) _vols[last] = volume;
        } else if (bar.time > (_ts[last] ?? 0)) {
            _ts.push(bar.time);
            _prices.push(bar.close);
            _ohlc.push({ time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
            if (volume != null) _vols.push(volume);
        } else {
            return; // out-of-order, skip
        }

        // Update price series (O(1) — TVLWC patches only the changed bar)
        try {
            if (_type === 'candlestick') {
                mainPriceSer.update({ time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
            } else {
                mainPriceSer.update({ time: bar.time, value: bar.close });
            }
        } catch (_) {}

        // Volume incremental update
        if (volumeSer && volume != null) {
            try {
                volumeSer.update({
                    time: bar.time, value: volume,
                    color: bar.close >= bar.open ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)',
                });
            } catch (_) {}
        }

        // Overlay indicator incremental updates
        const _c = _type === 'candlestick' ? _ohlc.map(d => d.close) : _prices;
        const _n = _c.length;

        if (_indicators.sma20 && _smaSer20 && _n >= 20) {
            const v = _c.slice(-20).reduce((a, b) => a + b, 0) / 20;
            try { _smaSer20.update({ time: bar.time, value: v }); } catch (_) {}
        }
        if (_indicators.sma50 && _smaSer50 && _n >= 50) {
            const v = _c.slice(-50).reduce((a, b) => a + b, 0) / 50;
            try { _smaSer50.update({ time: bar.time, value: v }); } catch (_) {}
        }
        if (_indicators.ema12 && _emaSer12 && _n >= 12) {
            const raw = Indicators.ema(_c, 12);
            const v = raw[raw.length - 1];
            if (v != null) try { _emaSer12.update({ time: bar.time, value: v }); } catch (_) {}
        }
        if (_indicators.ema26 && _emaSer26 && _n >= 26) {
            const raw = Indicators.ema(_c, 26);
            const v = raw[raw.length - 1];
            if (v != null) try { _emaSer26.update({ time: bar.time, value: v }); } catch (_) {}
        }
        if (_indicators.bb && _bbSerUp && _n >= 20) {
            const sl   = _c.slice(-20);
            const mean = sl.reduce((a, b) => a + b, 0) / 20;
            const std  = Math.sqrt(sl.reduce((a, b) => a + (b - mean) ** 2, 0) / 20);
            if (_bbSerUp)  try { _bbSerUp.update({ time: bar.time, value: mean + std * 2 }); }  catch (_) {}
            if (_bbSerLo)  try { _bbSerLo.update({ time: bar.time, value: mean - std * 2 }); }  catch (_) {}
            if (_bbSerMid) try { _bbSerMid.update({ time: bar.time, value: mean }); }            catch (_) {}
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  VOLUME  (TVLWC histogram)
    // ════════════════════════════════════════════════════════════════════════
    function renderVolumeChart(timestamps, volumes) {
        const el = document.getElementById('volumeChart');
        rmTV(volumeChart); volumeChart = null; volumeSer = null;
        _vols = volumes.slice();

        const hasData = volumes.some(v => v > 0);
        if (!hasData) {
            el.innerHTML = '<div class="text-center text-muted py-4 small" style="padding-top:45px!important"><i class="bi bi-bar-chart me-1"></i>Volume data unavailable for this asset</div>';
            return;
        }

        el.innerHTML = '';
        volumeChart = LightweightCharts.createChart(el, {
            ...TV,
            width:  el.clientWidth || 800,
            height: _subVolH(),
            timeScale: { ...TV.timeScale, visible: false },
        });

        volumeSer = volumeChart.addHistogramSeries({
            color: 'rgba(59,130,246,0.5)',
            priceFormat: { type: 'custom', formatter: volFmt },
            priceLineVisible: false,
            lastValueVisible: false,
        });

        const sTs = timestamps.map(toSec);
        volumeSer.setData(sTs.map((t, i) => ({
            time:  t,
            value: volumes[i] || 0,
            color: i > 0
                ? (volumes[i] >= volumes[i - 1] ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)')
                : 'rgba(59,130,246,0.5)',
        })));
        volumeChart.timeScale().fitContent();
        _animateChart(el.parentElement, true);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  RSI  (TVLWC line with 30/70 price lines)
    // ════════════════════════════════════════════════════════════════════════
    function renderRSIChart(timestamps, rsiValues) {
        const el = document.getElementById('rsiChart');
        el.innerHTML = '';
        rmTV(rsiChart); rsiChart = null; rsiSer = null; rsiAnchor = null;

        rsiChart = LightweightCharts.createChart(el, {
            ...TV,
            width:  el.clientWidth || 800,
            height: _subIndH(),
        });

        // Invisible anchor series forces 0-100 scale even when data is 30-70
        rsiAnchor = rsiChart.addLineSeries({ color: 'transparent', priceLineVisible: false, lastValueVisible: false, lineWidth: 0 });
        const sTs = timestamps.map(toSec);
        if (sTs.length >= 2) {
            rsiAnchor.setData([
                { time: sTs[0], value: 0 },
                { time: sTs[sTs.length - 1], value: 100 },
            ]);
        }

        rsiSer = rsiChart.addLineSeries({
            color: '#8b5cf6', lineWidth: 2, priceLineVisible: false,
            priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
        });
        rsiSer.setData(sTs.map((t, i) => rsiValues[i] !== null ? { time: t, value: rsiValues[i] } : null).filter(Boolean));
        rsiSer.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'OB' });
        rsiSer.createPriceLine({ price: 30, color: '#10b981', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'OS' });

        rsiChart.timeScale().fitContent();
        _animateChart(el.parentElement, true);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  MACD  (TVLWC histogram + two lines)
    // ════════════════════════════════════════════════════════════════════════
    function renderMACDChart(timestamps, macdData) {
        const el = document.getElementById('macdChart');
        el.innerHTML = '';
        rmTV(macdChart); macdChart = null; macdLine = null; macdSig = null; macdHist = null;

        const { macdLine: ml, signalLine: sl, histogram: hl } = macdData;
        const sTs = timestamps.map(toSec);

        macdChart = LightweightCharts.createChart(el, {
            ...TV,
            width:  el.clientWidth || 800,
            height: _subIndH(),
        });

        macdHist = macdChart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
        macdLine = macdChart.addLineSeries({ color: '#3b82f6', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
        macdSig  = macdChart.addLineSeries({ color: '#f59e0b', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });

        macdHist.setData(sTs.map((t, i) => hl[i] !== null ? {
            time: t, value: hl[i],
            color: hl[i] >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)',
        } : null).filter(Boolean));
        macdLine.setData(sTs.map((t, i) => ml[i] !== null ? { time: t, value: ml[i] } : null).filter(Boolean));
        macdSig.setData( sTs.map((t, i) => sl[i] !== null ? { time: t, value: sl[i] } : null).filter(Boolean));

        macdChart.timeScale().fitContent();
        _animateChart(el.parentElement, true);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PREDICTION  (ApexCharts — retained, TVLWC has no regression overlay)
    // ════════════════════════════════════════════════════════════════════════
    function renderPredictionChart(histTs, histPrices, futureTs, fitted, future) {
        rmApex(predChart); predChart = null;
        const el = document.getElementById('predictionChart');
        // Read height while spinner is still inside — flex parent has settled by now.
        const h = Math.max(420, el.offsetHeight || 420);
        el.innerHTML = '';

        predChart = new ApexCharts(el, {
            ...base,
            series: [
                { name: 'Historical Price', data: histTs.map((t, i)   => ({ x: t, y: histPrices[i] })) },
                { name: 'Regression Fit',   data: histTs.map((t, i)   => ({ x: t, y: fitted[i] })) },
                { name: 'Predicted Price',  data: futureTs.map((t, i) => ({ x: t, y: future[i] })) },
            ],
            chart: { ...base.chart, type: 'line', height: h },
            stroke: { curve: 'smooth', width: [2, 1.5, 2.5], dashArray: [0, 6, 0] },
            colors: ['#3b82f6', '#f59e0b', '#10b981'],
            fill:   { type: ['gradient', 'solid', 'gradient'], gradient: { opacityFrom: 0.15, opacityTo: 0.01 } },
            xaxis:  { ...base.xaxis, type: 'datetime' },
            yaxis:  { ...base.yaxis, labels: { ...base.yaxis.labels, formatter: usdFormatter } },
            annotations: {
                xaxis: [{
                    x: histTs[histTs.length - 1], borderColor: '#475569', strokeDashArray: 6,
                    label: { style: { background: 'transparent', color: '#64748b', fontSize: '10px' }, text: '◀ Historical  |  Predicted ▶', orientation: 'horizontal' },
                }],
            },
            tooltip: { ...base.tooltip, x: { format: 'dd MMM yyyy' } },
        });
        predChart.render();
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PORTFOLIO DONUT  (ApexCharts — retained)
    // ════════════════════════════════════════════════════════════════════════
    function renderAllocationChart(labels, values) {
        rmApex(allocChart); allocChart = null;
        const el = document.getElementById('allocationChart');
        if (!labels.length) {
            el.innerHTML = '<div class="text-center text-muted py-4 small">No holdings yet.</div>';
            return;
        }
        el.innerHTML = '';
        allocChart = new ApexCharts(el, {
            ...base,
            series: values, labels,
            chart: { ...base.chart, type: 'donut', height: 200, toolbar: { show: false } },
            plotOptions: { pie: { donut: { size: '55%', labels: { show: true, total: { show: true, label: 'Total', color: '#94a3b8', formatter: w => '$' + w.globals.seriesTotals.reduce((a, b) => a + b, 0).toFixed(2) } } } } },
            legend: { position: 'right', labels: { colors: '#94a3b8' } },
            tooltip: { y: { formatter: v => '$' + v.toFixed(2) } },
        });
        allocChart.render();
    }

    // ════════════════════════════════════════════════════════════════════════
    //  COMPARISON  (ApexCharts — retained)
    // ════════════════════════════════════════════════════════════════════════
    function renderComparisonChart(datasets) {
        rmApex(compareChart); compareChart = null;
        const el = document.getElementById('comparisonChart');
        if (!el) return;
        el.innerHTML = '';

        const series = datasets.map(d => ({
            name: d.name,
            data: d.prices.map((p, i) => ({ x: d.timestamps[i], y: parseFloat(((p / d.prices[0] - 1) * 100).toFixed(2)) })),
        }));

        compareChart = new ApexCharts(el, {
            ...base, series,
            chart: { ...base.chart, type: 'line', height: 320 },
            stroke: { curve: 'smooth', width: 2 },
            colors: ['#00d4ff', '#10b981', '#f59e0b'],
            yaxis:  { ...base.yaxis, labels: { ...base.yaxis.labels, formatter: v => v?.toFixed(1) + '%' } },
            xaxis:  { ...base.xaxis, type: 'datetime' },
            tooltip: { ...base.tooltip, x: { format: 'dd MMM' }, y: { formatter: v => v?.toFixed(2) + '%' } },
            annotations: { yaxis: [{ y: 0, borderColor: '#475569', strokeDashArray: 4 }] },
        });
        compareChart.render();
    }

    // ════════════════════════════════════════════════════════════════════════
    //  SENTIMENT SPARKLINE  (ApexCharts — retained)
    // ════════════════════════════════════════════════════════════════════════
    function renderSentimentHistoryChart(histData) {
        rmApex(sentHistChart); sentHistChart = null;
        const el = document.getElementById('saHistoryChart');
        if (!el || !histData.length) return;
        el.innerHTML = '';

        const scores   = histData.map(d => d.score);
        const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const color    = avgScore > 60 ? '#00e5a0' : avgScore > 40 ? '#fbbf24' : '#ff8c42';

        sentHistChart = new ApexCharts(el, {
            chart: { type: 'area', height: 65, sparkline: { enabled: true }, animations: { enabled: true, speed: 800 }, background: 'transparent' },
            series: [{ name: 'Sentiment', data: histData.map(d => ({ x: d.ts, y: d.score })) }],
            colors: [color],
            fill:   { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0, stops: [0, 100] } },
            stroke: { curve: 'smooth', width: 2 },
            yaxis:  { min: 0, max: 100 },
            xaxis:  { type: 'datetime' },
            annotations: { yaxis: [{ y: 50, borderColor: 'rgba(255,255,255,0.15)', strokeDashArray: 4 }] },
            tooltip: {
                theme: 'dark',
                x: { formatter: v => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' }) },
                y: { title: { formatter: () => 'Score' }, formatter: v => v + '/100' },
            },
        });
        sentHistChart.render();
    }

    // ════════════════════════════════════════════════════════════════════════
    //  LIFECYCLE
    // ════════════════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════════════════
    //  DOWNLOAD CHART  (composite PNG with header + sub-chart)
    // ════════════════════════════════════════════════════════════════════════
    function downloadChart(coinName, symbol, tfLabel, activeSub) {
        if (!mainChart) return;

        try {
            const mainCanvas = mainChart.takeScreenshot();

            // Capture the currently visible sub-chart (if rendered)
            let subCanvas = null;
            if      (activeSub === 'volume' && volumeChart) subCanvas = volumeChart.takeScreenshot();
            else if (activeSub === 'rsi'    && rsiChart)    subCanvas = rsiChart.takeScreenshot();
            else if (activeSub === 'macd'   && macdChart)   subCanvas = macdChart.takeScreenshot();

            const W      = mainCanvas.width;
            const HDR    = 52;
            const FTR    = 26;
            const subH   = subCanvas ? subCanvas.height : 0;
            const totalH = HDR + mainCanvas.height + subH + FTR;

            const out = document.createElement('canvas');
            out.width  = W;
            out.height = totalH;
            const ctx  = out.getContext('2d');

            // ── Background ───────────────────────────────────────────────
            ctx.fillStyle = '#07101f';
            ctx.fillRect(0, 0, W, totalH);

            // ── Header bar ───────────────────────────────────────────────
            ctx.fillStyle = '#0c1929';
            ctx.fillRect(0, 0, W, HDR);
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, HDR); ctx.lineTo(W, HDR); ctx.stroke();

            // Coin name + symbol
            ctx.font = 'bold 16px "Inter", "Segoe UI", sans-serif';
            ctx.fillStyle = '#f1f5f9';
            const label = `${coinName}  ·  ${symbol}`;
            ctx.fillText(label, 16, 32);

            // Timeframe badge
            const labelW  = ctx.measureText(label).width;
            const tfX     = 16 + labelW + 14;
            ctx.font = 'bold 11px "Inter", "Segoe UI", sans-serif';
            const tfW = ctx.measureText(tfLabel).width + 14;
            ctx.fillStyle = 'rgba(59,130,246,0.18)';
            ctx.strokeStyle = 'rgba(59,130,246,0.45)';
            ctx.lineWidth = 1;
            _roundRect(ctx, tfX, 18, tfW, 20, 4);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#93c5fd';
            ctx.fillText(tfLabel, tfX + 7, 32);

            // Timestamp (right-aligned)
            const now = new Date().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            ctx.font = '11px "Inter", "Segoe UI", sans-serif';
            ctx.fillStyle = '#475569';
            const nowW = ctx.measureText(now).width;
            ctx.fillText(now, W - nowW - 16, 32);

            // ── Charts ───────────────────────────────────────────────────
            ctx.drawImage(mainCanvas, 0, HDR);

            if (subCanvas) {
                ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(0, HDR + mainCanvas.height); ctx.lineTo(W, HDR + mainCanvas.height); ctx.stroke();
                ctx.drawImage(subCanvas, 0, HDR + mainCanvas.height);
            }

            // ── Footer bar ───────────────────────────────────────────────
            const footerY = totalH - FTR;
            ctx.fillStyle = '#0c1929';
            ctx.fillRect(0, footerY, W, FTR);
            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, footerY); ctx.lineTo(W, footerY); ctx.stroke();

            ctx.font = '10px "Inter", "Segoe UI", sans-serif';
            ctx.fillStyle = '#334155';
            ctx.fillText('Powered by CRYVORA  ·  Data: Binance / Coinlore  ·  For educational use only', 16, footerY + 17);

            // Cryvora label right-aligned
            ctx.fillStyle = '#3b82f6';
            ctx.font = 'bold 10px "Inter", "Segoe UI", sans-serif';
            const brandW = ctx.measureText('CRYVORA').width;
            ctx.fillText('CRYVORA', W - brandW - 16, footerY + 17);

            // ── Trigger download ─────────────────────────────────────────
            const slug = coinName.toLowerCase().replace(/\s+/g, '-');
            const link = document.createElement('a');
            link.download = `cryvora-${slug}-${tfLabel.toLowerCase()}.png`;
            link.href = out.toDataURL('image/png');
            link.click();

        } catch (err) {
            console.error('Chart screenshot failed:', err);
        }
    }

    function _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function destroySubCharts() {
        rmTV(volumeChart); volumeChart = null; volumeSer  = null;
        rmTV(rsiChart);    rsiChart    = null; rsiSer     = null; rsiAnchor = null;
        rmTV(macdChart);   macdChart   = null; macdLine   = null; macdSig   = null; macdHist = null;
    }

    function destroyAll() {
        rmTV(mainChart);
        mainChart = null; mainPriceSer = null; mainPriceLines = [];
        _smaSer20 = _smaSer50 = _emaSer12 = _emaSer26 = null;
        _bbSerUp  = _bbSerLo  = _bbSerMid = _vwapSer  = null;
        _ts = []; _prices = []; _ohlc = []; _vols = [];
        destroySubCharts();
    }

    const hasRSI  = () => rsiChart  !== null;
    const hasMACD = () => macdChart !== null;

    function addAnnotation(ann)  { annotations.push(ann); _applyAnnotations(); }
    function removeAnnotation(i) { annotations.splice(i, 1); _applyAnnotations(); }
    function getAnnotations()    { return annotations; }

    // ── Zoom in / out via logical range ──────────────────────────────────────
    function _zoom(factor) {
        if (!mainChart) return;
        const range = mainChart.timeScale().getVisibleLogicalRange();
        if (!range) return;
        const mid  = (range.from + range.to) / 2;
        const half = (range.to - range.from) / 2 * factor;
        mainChart.timeScale().setVisibleLogicalRange({ from: mid - half, to: mid + half });
        // sub-charts sync automatically via _syncTimescales subscription
    }

    const zoomIn  = () => _zoom(0.7);   // shrink visible range by 30%
    const zoomOut = () => _zoom(1 / 0.7); // expand visible range by ~43%

    // ── Coordinate helpers for drawing tool ──────────────────────────────────
    // Convert a chart time (Unix seconds) to canvas pixel x.
    // Falls back to linear interpolation when the exact bar isn't in the current
    // timeframe — keeps drawings visible across timeframe switches.
    function timeToX(t) {
        if (!mainChart) return null;
        try {
            const x = mainChart.timeScale().timeToCoordinate(t);
            if (x !== null) return x;
            // Fallback: interpolate from visible time range
            const vr = mainChart.timeScale().getVisibleRange();
            if (!vr) return null;
            const w = document.getElementById('mainChart')?.clientWidth || 0;
            if (!w) return null;
            const tN  = +t;
            const frN = typeof vr.from === 'string' ? new Date(vr.from).getTime() / 1000 : +vr.from;
            const toN = typeof vr.to   === 'string' ? new Date(vr.to  ).getTime() / 1000 : +vr.to;
            return frN === toN ? null : ((tN - frN) / (toN - frN)) * w;
        } catch (_) { return null; }
    }

    // Convert a price to canvas pixel y.
    function priceToY(p) {
        try { return mainPriceSer?.priceToCoordinate(p) ?? null; }
        catch (_) { return null; }
    }

    // Convert canvas pixel x to a chart time (Unix seconds).
    // Falls back to linear interpolation when there's no bar at that x.
    function xToTime(x) {
        if (!mainChart) return null;
        try {
            const t = mainChart.timeScale().coordinateToTime(x);
            if (t !== null) return t;
            const vr = mainChart.timeScale().getVisibleRange();
            if (!vr) return null;
            const w = document.getElementById('mainChart')?.clientWidth || 0;
            if (!w) return null;
            const frN = typeof vr.from === 'string' ? new Date(vr.from).getTime() / 1000 : +vr.from;
            const toN = typeof vr.to   === 'string' ? new Date(vr.to  ).getTime() / 1000 : +vr.to;
            return frN + (x / w) * (toN - frN);
        } catch (_) { return null; }
    }

    // Convert canvas pixel y to a price.
    function yToPrice(y) {
        try { return mainPriceSer?.coordinateToPrice(y) ?? null; }
        catch (_) { return null; }
    }

    // Subscribe fn to chart scroll/zoom — called by TrendDraw after each chart render.
    function onScrollRedraw(fn) {
        try { mainChart?.timeScale().subscribeVisibleLogicalRangeChange(fn); }
        catch (_) {}
    }

    function clearPredChart() { rmApex(predChart); predChart = null; }

    return {
        renderMainChart, updateMainChartBar, applyIndicators,
        renderVolumeChart, renderRSIChart, renderMACDChart,
        clearPredChart, renderPredictionChart, renderAllocationChart,
        renderComparisonChart, renderSentimentHistoryChart,
        downloadChart, zoomIn, zoomOut,
        destroySubCharts, destroyAll,
        addAnnotation, removeAnnotation, getAnnotations,
        hasRSI, hasMACD,
        timeToX, priceToY, xToTime, yToPrice, onScrollRedraw,
    };
})();
