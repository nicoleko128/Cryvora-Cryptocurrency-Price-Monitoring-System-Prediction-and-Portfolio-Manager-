/**
 * prediction.js – Linear regression price prediction
 */
const Prediction = (() => {

    function linearRegression(prices) {
        const n = prices.length;
        const x = Array.from({ length: n }, (_, i) => i);

        const sumX  = x.reduce((a, b) => a + b, 0);
        const sumY  = prices.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((acc, xi, i) => acc + xi * prices[i], 0);
        const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);

        const slope     = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        const meanY = sumY / n;
        const ssTot = prices.reduce((acc, y) => acc + (y - meanY) ** 2, 0);
        const ssRes = prices.reduce((acc, y, i) => acc + (y - (intercept + slope * i)) ** 2, 0);
        const r2    = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

        return { slope, intercept, r2 };
    }

    function predict(prices, futureDays) {
        const { slope, intercept, r2 } = linearRegression(prices);
        const n = prices.length;

        const fitted = prices.map((_, i) => intercept + slope * i);
        const future = Array.from({ length: futureDays }, (_, i) =>
            Math.max(0, intercept + slope * (n + i))
        );

        return { fitted, future, slope, intercept, r2 };
    }

    return { predict };
})();
