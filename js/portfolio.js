/**
 * portfolio.js – Holdings management with localStorage + edit support
 */
const Portfolio = (() => {
    const KEY = 'cryptovision_portfolio';

    const COINS = {
        'bitcoin':             { name: 'Bitcoin',            symbol: 'BTC'   },
        'ethereum':            { name: 'Ethereum',           symbol: 'ETH'   },
        'binancecoin':         { name: 'BNB',                symbol: 'BNB'   },
        'solana':              { name: 'Solana',             symbol: 'SOL'   },
        'ripple':              { name: 'XRP',                symbol: 'XRP'   },
        'dogecoin':            { name: 'Dogecoin',           symbol: 'DOGE'  },
        'cardano':             { name: 'Cardano',            symbol: 'ADA'   },
        'tron':                { name: 'Tron',               symbol: 'TRX'   },
        'avalanche-2':         { name: 'Avalanche',          symbol: 'AVAX'  },
        'shiba-inu':           { name: 'Shiba Inu',          symbol: 'SHIB'  },
        'chainlink':           { name: 'Chainlink',          symbol: 'LINK'  },
        'polkadot':            { name: 'Polkadot',           symbol: 'DOT'   },
        'bitcoin-cash':        { name: 'Bitcoin Cash',       symbol: 'BCH'   },
        'near':                { name: 'NEAR Protocol',      symbol: 'NEAR'  },
        'litecoin':            { name: 'Litecoin',           symbol: 'LTC'   },
        'uniswap':             { name: 'Uniswap',            symbol: 'UNI'   },
        'cosmos':              { name: 'Cosmos',             symbol: 'ATOM'  },
        'aptos':               { name: 'Aptos',              symbol: 'APT'   },
        'hedera-hashgraph':    { name: 'Hedera',             symbol: 'HBAR'  },
        'internet-computer':   { name: 'Internet Computer',  symbol: 'ICP'   },
        'monero':              { name: 'Monero',             symbol: 'XMR'   },
        'ethereum-classic':    { name: 'Ethereum Classic',   symbol: 'ETC'   },
        'stellar':             { name: 'Stellar',            symbol: 'XLM'   },
        'vechain':             { name: 'VeChain',            symbol: 'VET'   },
        'algorand':            { name: 'Algorand',           symbol: 'ALGO'  },
        'filecoin':            { name: 'Filecoin',           symbol: 'FIL'   },
        'injective-protocol':  { name: 'Injective',          symbol: 'INJ'   },
        'render-token':        { name: 'Render',             symbol: 'RNDR'  },
        'matic-network':       { name: 'Polygon',            symbol: 'MATIC' },
        'the-graph':           { name: 'The Graph',          symbol: 'GRT'   },
        'fetch-ai':            { name: 'Fetch.AI',           symbol: 'FET'   },
        'toncoin':             { name: 'Toncoin',            symbol: 'TON'   },
        'arbitrum':            { name: 'Arbitrum',           symbol: 'ARB'   },
        'optimism':            { name: 'Optimism',           symbol: 'OP'    },
        'fantom':              { name: 'Fantom',             symbol: 'FTM'   },
        'aave':                { name: 'Aave',               symbol: 'AAVE'  },
        'maker':               { name: 'Maker',              symbol: 'MKR'   },
        'the-sandbox':         { name: 'The Sandbox',        symbol: 'SAND'  },
        'decentraland':        { name: 'Decentraland',       symbol: 'MANA'  },
        'axie-infinity':       { name: 'Axie Infinity',      symbol: 'AXS'   },
        'stacks':              { name: 'Stacks',             symbol: 'STX'   },
        'lido-dao':            { name: 'Lido DAO',           symbol: 'LDO'   },
        'curve-dao-token':     { name: 'Curve DAO',          symbol: 'CRV'   },
        'sui':                 { name: 'Sui',                symbol: 'SUI'   },
        'sei-network':         { name: 'Sei',                symbol: 'SEI'   },
        'pepe':                { name: 'Pepe',               symbol: 'PEPE'  },
        'kaspa':               { name: 'Kaspa',              symbol: 'KAS'   },
        'floki':               { name: 'Floki',              symbol: 'FLOKI' },
        'worldcoin-wld':       { name: 'Worldcoin',          symbol: 'WLD'   },
        'mantle':              { name: 'Mantle',             symbol: 'MNT'   },
    };

    let holdings = JSON.parse(localStorage.getItem(KEY) || '[]');

    function save() { localStorage.setItem(KEY, JSON.stringify(holdings)); }

    function add(coinId, name, symbol, qty, buyPrice, buyDate) {
        holdings.push({
            id:       Date.now(),
            coinId,
            name:     name   || COINS[coinId]?.name   || coinId,
            symbol:   symbol || COINS[coinId]?.symbol || coinId.toUpperCase(),
            qty:      parseFloat(qty),
            buyPrice: parseFloat(buyPrice),
            buyDate:  buyDate || '',
        });
        save();
    }

    function update(id, qty, buyPrice, buyDate) {
        const h = holdings.find(h => h.id === id);
        if (!h) return;
        h.qty      = parseFloat(qty);
        h.buyPrice = parseFloat(buyPrice);
        h.buyDate  = buyDate || '';
        save();
    }

    function remove(id) {
        holdings = holdings.filter(h => h.id !== id);
        save();
    }

    function clear() { holdings = []; save(); }

    function getAll()           { return holdings; }
    function getById(id)        { return holdings.find(h => h.id === id); }
    function getUniqueCoinIds() { return [...new Set(holdings.map(h => h.coinId))]; }

    return { add, update, remove, clear, getAll, getById, getUniqueCoinIds };
})();
