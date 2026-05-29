/**
 * theme.js – Dark / Light mode with localStorage persistence
 */
const Theme = (() => {
    const KEY = 'cryvora_theme';

    function apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(KEY, theme);
        const btn = document.getElementById('themeToggle');
        if (btn) {
            btn.innerHTML = theme === 'dark'
                ? '<i class="bi bi-sun-fill"></i>'
                : '<i class="bi bi-moon-stars-fill"></i>';
            btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        }
    }

    function toggle() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        apply(current === 'dark' ? 'light' : 'dark');
    }

    function init() {
        const saved = localStorage.getItem(KEY) || 'dark';
        apply(saved);
    }

    return { init, toggle };
})();
