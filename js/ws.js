/**
 * ws.js — Binance WebSocket manager
 * Streams kline + miniTicker for the active chart coin.
 * RAF-throttled so callbacks never fire faster than display refresh rate.
 */
const WS = (() => {
    let _ws            = null;
    let _symbol        = null;
    let _interval      = null;
    let _onKline       = null;
    let _onTicker      = null;
    let _rafId         = null;
    let _pendingKline  = null;
    let _pendingTicker = null;
    let _reconnTimer   = null;
    let _alive         = false;

    function connect(symbol, interval, { onKline, onTicker } = {}) {
        disconnect();
        if (!symbol || !interval) return;

        _symbol   = symbol.toLowerCase();
        _interval = interval;
        _onKline  = onKline  || null;
        _onTicker = onTicker || null;
        _alive    = true;
        _open();
    }

    function _open() {
        if (!_alive) return;
        const streams = `${_symbol}@kline_${_interval}/${_symbol}@miniTicker`;
        _ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

        _ws.onopen = () => {
            const dot = document.getElementById('wsLiveDot');
            if (dot) dot.style.display = 'inline-block';
        };

        _ws.onmessage = (evt) => {
            try {
                const msg    = JSON.parse(evt.data);
                const stream = msg.stream || '';
                const data   = msg.data;

                if (stream.includes('@kline_')) {
                    const k = data.k;
                    _pendingKline = {
                        t: k.t,
                        o: parseFloat(k.o),
                        h: parseFloat(k.h),
                        l: parseFloat(k.l),
                        c: parseFloat(k.c),
                        v: parseFloat(k.v),
                        x: k.x,
                    };
                } else if (stream.includes('@miniTicker')) {
                    const open  = parseFloat(data.o);
                    const close = parseFloat(data.c);
                    _pendingTicker = {
                        price:     close,
                        change24h: open > 0 ? ((close - open) / open) * 100 : 0,
                        high24:    parseFloat(data.h),
                        low24:     parseFloat(data.l),
                    };
                }

                _flush();
            } catch (_) {}
        };

        _ws.onclose = () => {
            _ws = null;
            const dot = document.getElementById('wsLiveDot');
            if (dot) dot.style.display = 'none';
            if (_alive) _reconnTimer = setTimeout(_open, 3000);
        };

        _ws.onerror = () => {
            try { _ws?.close(); } catch (_) {}
        };
    }

    function _flush() {
        if (_rafId) return;
        _rafId = requestAnimationFrame(() => {
            _rafId = null;
            if (_pendingTicker && _onTicker) {
                _onTicker(_pendingTicker);
                _pendingTicker = null;
            }
            if (_pendingKline && _onKline) {
                _onKline(_pendingKline);
                _pendingKline = null;
            }
        });
    }

    function disconnect() {
        _alive = false;
        clearTimeout(_reconnTimer);
        if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
        if (_ws) {
            _ws.onclose = null;
            try { _ws.close(); } catch (_) {}
            _ws = null;
        }
        _pendingKline  = null;
        _pendingTicker = null;
        const dot = document.getElementById('wsLiveDot');
        if (dot) dot.style.display = 'none';
    }

    return { connect, disconnect };
})();
