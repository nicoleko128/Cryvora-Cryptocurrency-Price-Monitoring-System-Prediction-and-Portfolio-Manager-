/**
 * recommendation.js – Smart Buy / Hold / Sell signal engine
 * Combines RSI, MACD histogram, and linear regression slope
 */
const Recommendation = (() => {

    /**
     * @param {number[]} rsiValues  – full RSI array (nulls at start)
     * @param {object}   macdData   – { macdLine, signalLine, histogram }
     * @param {number}   predSlope  – slope from linear regression
     * @param {number}   r2         – R² coefficient (0–1)
     */
    function analyze(rsiValues, macdData, predSlope, r2) {
        const rsi       = rsiValues.filter(v => v !== null).slice(-1)[0];
        const hist      = macdData.histogram.filter(v => v !== null);
        const latestH   = hist.at(-1);
        const prevH     = hist.at(-2) ?? 0;

        let score = 0;
        const reasons = [];

        /* ── RSI ─────────────────────────────── */
        if (rsi <= 25)       { score += 3; reasons.push(`RSI ${rsi.toFixed(1)} — extreme oversold (strong buy)`); }
        else if (rsi <= 35)  { score += 2; reasons.push(`RSI ${rsi.toFixed(1)} — oversold (buy signal)`); }
        else if (rsi <= 45)  { score += 1; reasons.push(`RSI ${rsi.toFixed(1)} — below midpoint (mild buy)`); }
        else if (rsi >= 75)  { score -= 3; reasons.push(`RSI ${rsi.toFixed(1)} — extreme overbought (strong sell)`); }
        else if (rsi >= 65)  { score -= 2; reasons.push(`RSI ${rsi.toFixed(1)} — overbought (sell signal)`); }
        else if (rsi >= 55)  { score -= 1; reasons.push(`RSI ${rsi.toFixed(1)} — above midpoint (mild sell)`); }
        else                  { reasons.push(`RSI ${rsi.toFixed(1)} — neutral zone`); }

        /* ── MACD ────────────────────────────── */
        if (latestH > 0 && prevH <= 0)       { score += 2; reasons.push('MACD bullish crossover detected'); }
        else if (latestH > 0 && prevH > 0)   { score += 1; reasons.push('MACD histogram positive (bullish momentum)'); }
        else if (latestH < 0 && prevH >= 0)  { score -= 2; reasons.push('MACD bearish crossover detected'); }
        else if (latestH < 0 && prevH < 0)   { score -= 1; reasons.push('MACD histogram negative (bearish momentum)'); }

        /* ── Prediction ──────────────────────── */
        if (r2 > 0.5) {
            if (predSlope > 0)      { score += 1; reasons.push('Linear regression: upward price trend'); }
            else if (predSlope < 0) { score -= 1; reasons.push('Linear regression: downward price trend'); }
        } else {
            reasons.push('Prediction R² too low — regression not reliable');
        }

        /* ── Decision ────────────────────────── */
        let action;
        if (score >= 3)       action = 'BUY';
        else if (score <= -3) action = 'SELL';
        else                  action = 'HOLD';

        // Confidence grows with signal strength and prediction quality
        const confidence = Math.round(
            Math.min(95, 35 + Math.abs(score) * 10 + (r2 > 0.6 ? 15 : 0))
        );

        return { action, score, confidence, reasons };
    }

    return { analyze };
})();
