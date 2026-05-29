/**
 * indicators.js – Technical analysis indicators (SMA, EMA, RSI, MACD, Bollinger Bands)
 */
const Indicators = (() => {

    function sma(data, period) {
        const result = new Array(data.length).fill(null);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i];
            if (i >= period) sum -= data[i - period];
            if (i >= period - 1) result[i] = sum / period;
        }
        return result;
    }

    function ema(data, period) {
        const k = 2 / (period + 1);
        const result = new Array(data.length).fill(null);
        let prev = null;
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) continue;
            if (prev === null) {
                prev = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
                result[i] = prev;
                continue;
            }
            prev = data[i] * k + prev * (1 - k);
            result[i] = prev;
        }
        return result;
    }

    function rsi(data, period = 14) {
        const result = new Array(data.length).fill(null);
        if (data.length < period + 1) return result;

        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const d = data[i] - data[i - 1];
            if (d > 0) gains += d; else losses -= d;
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;
        result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

        for (let i = period + 1; i < data.length; i++) {
            const d = data[i] - data[i - 1];
            avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
            avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
            result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
        }
        return result;
    }

    function macd(data, fast = 12, slow = 26, signal = 9) {
        const fastEMA = ema(data, fast);
        const slowEMA = ema(data, slow);

        const macdLine = data.map((_, i) =>
            fastEMA[i] !== null && slowEMA[i] !== null ? fastEMA[i] - slowEMA[i] : null
        );

        // Compute EMA of macdLine for signal
        const validMacd = macdLine.filter(v => v !== null);
        const signalRaw = ema(validMacd, signal);

        const signalLine = new Array(data.length).fill(null);
        let si = 0;
        macdLine.forEach((v, i) => {
            if (v !== null) { signalLine[i] = signalRaw[si] ?? null; si++; }
        });

        const histogram = data.map((_, i) =>
            macdLine[i] !== null && signalLine[i] !== null ? macdLine[i] - signalLine[i] : null
        );

        return { macdLine, signalLine, histogram };
    }

    function bollingerBands(data, period = 20, multiplier = 2) {
        const mid = sma(data, period);
        // Use a sliding sum-of-squares to avoid O(n * period) slice+reduce
        const result = new Array(data.length).fill(null).map(() => ({ upper: null, middle: null, lower: null }));
        let sumSq = 0, sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum   += data[i];
            sumSq += data[i] * data[i];
            if (i >= period) {
                sum   -= data[i - period];
                sumSq -= data[i - period] * data[i - period];
            }
            if (i >= period - 1 && mid[i] !== null) {
                const mean = mid[i];
                const variance = sumSq / period - mean * mean;
                const sd = Math.sqrt(Math.max(0, variance));
                result[i] = { upper: mean + multiplier * sd, middle: mean, lower: mean - multiplier * sd };
            }
        }
        return result;
    }

    function vwap(ohlcData, vols) {
        let cumTPV = 0, cumVol = 0;
        return ohlcData.map((d, i) => {
            const vol = vols[i] ?? 0;
            if (vol === 0) return cumVol === 0 ? null : cumTPV / cumVol;
            const tp = (d.high + d.low + d.close) / 3;
            cumTPV += tp * vol;
            cumVol += vol;
            return cumTPV / cumVol;
        });
    }

    return { sma, ema, rsi, macd, bollingerBands, vwap };
})();
