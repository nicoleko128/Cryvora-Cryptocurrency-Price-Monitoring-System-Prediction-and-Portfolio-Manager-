/**
 * watchlist.js – Favourite coins with localStorage persistence
 */
const Watchlist = (() => {
    const KEY = 'cryvora_watchlist';

    const defaults = [
        { id: 'bitcoin',  name: 'Bitcoin',  symbol: 'BTC' },
        { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
        { id: 'solana',   name: 'Solana',   symbol: 'SOL' },
    ];

    let coins = JSON.parse(localStorage.getItem(KEY) || 'null') || defaults;

    function save() { localStorage.setItem(KEY, JSON.stringify(coins)); }

    // Returns true if added, false if already present
    function add(id, name, symbol) {
        if (coins.find(c => c.id === id)) return false;
        coins.push({ id, name, symbol });
        save();
        return true;
    }

    function remove(id) {
        coins = coins.filter(c => c.id !== id);
        save();
    }

    function has(id)   { return !!coins.find(c => c.id === id); }
    function getAll()  { return coins; }
    function getIds()  { return coins.map(c => c.id); }

    return { add, remove, has, getAll, getIds };
})();
