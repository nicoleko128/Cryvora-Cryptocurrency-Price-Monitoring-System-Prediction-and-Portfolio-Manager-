/**
 * custom-select.js — Animated dropdown replacing native <select> elements
 */
class CustomSelect {
    constructor(selectEl, options = {}) {
        this.select = selectEl;
        this.options = options;
        this.isOpen = false;
        this.searchTerm = '';
        this._build();
        this._bindEvents();
    }

    _build() {
        this.select.style.display = 'none';

        this.wrapper = document.createElement('div');
        this.wrapper.className = 'csel-wrapper';
        if (this.options.className) this.wrapper.classList.add(this.options.className);

        this.trigger = document.createElement('button');
        this.trigger.type = 'button';
        this.trigger.className = 'csel-trigger';

        this.triggerLabel = document.createElement('span');
        this.triggerLabel.className = 'csel-trigger-label';

        this.triggerArrow = document.createElement('span');
        this.triggerArrow.className = 'csel-arrow';
        this.triggerArrow.innerHTML = '<i class="bi bi-chevron-down"></i>';

        this.trigger.append(this.triggerLabel, this.triggerArrow);

        this.panel = document.createElement('div');
        this.panel.className = 'csel-panel';

        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.className = 'csel-search';
        this.searchInput.placeholder = 'Search...';
        if (this.options.noSearch) this.searchInput.style.display = 'none';

        this.listEl = document.createElement('ul');
        this.listEl.className = 'csel-list';

        this.panel.append(this.searchInput, this.listEl);

        // Panel lives on body so no parent overflow can clip it
        document.body.appendChild(this.panel);

        this.wrapper.appendChild(this.trigger);
        this.select.parentNode.insertBefore(this.wrapper, this.select.nextSibling);

        this._renderOptions();
        this._updateTrigger();
    }

    _renderOptions(filter = '') {
        this.listEl.innerHTML = '';
        const opts = Array.from(this.select.options);
        const filtered = filter
            ? opts.filter(o => o.text.toLowerCase().includes(filter.toLowerCase()))
            : opts;

        filtered.forEach(opt => {
            const li = document.createElement('li');
            li.className = 'csel-item' + (opt.value === this.select.value ? ' selected' : '');
            if (!opt.value) li.classList.add('csel-item-none');
            li.dataset.value = opt.value;
            li.dataset.text = opt.text;
            li.innerHTML = `<span class="csel-item-text">${opt.text}</span>`;
            li.addEventListener('click', () => this._select(opt.value, opt.text));
            this.listEl.appendChild(li);
        });

        if (!filtered.length) {
            const li = document.createElement('li');
            li.className = 'csel-item csel-no-results';
            li.textContent = 'No results found';
            this.listEl.appendChild(li);
        }
    }

    _select(value, text) {
        this.select.value = value;
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
        this._updateTrigger();
        this._close();
    }

    _updateTrigger() {
        const selected = this.select.options[this.select.selectedIndex];
        this.triggerLabel.textContent = selected ? selected.text : '— Select —';
    }

    _positionPanel() {
        const rect = this.trigger.getBoundingClientRect();
        const panelMaxH = 300;
        const spaceBelow = window.innerHeight - rect.bottom - 10;
        const spaceAbove = rect.top - 10;
        const openUp = spaceBelow < panelMaxH && spaceAbove > spaceBelow;

        this.panel.style.left   = rect.left + 'px';
        this.panel.style.width  = rect.width + 'px';
        this.panel.style.right  = 'auto';
        this.panel.style.zIndex = '99999';

        if (openUp) {
            this.panel.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
            this.panel.style.top    = 'auto';
        } else {
            this.panel.style.top    = (rect.bottom + 6) + 'px';
            this.panel.style.bottom = 'auto';
        }
    }

    _open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.wrapper.classList.add('open');
        this.triggerArrow.querySelector('i').className = 'bi bi-chevron-up';
        this.searchInput.value = '';
        this._renderOptions();

        // Show before positioning so getBoundingClientRect is accurate
        this.panel.style.display = 'flex';
        this._positionPanel();

        if (!this.options.noSearch) this.searchInput.focus();

        // Close other open selects
        document.querySelectorAll('.csel-wrapper.open').forEach(w => {
            if (w !== this.wrapper) w._csel?._close();
        });
    }

    _close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.wrapper.classList.remove('open');
        this.triggerArrow.querySelector('i').className = 'bi bi-chevron-down';
        this.panel.style.display = '';
    }

    _bindEvents() {
        this.wrapper._csel = this;

        this.trigger.addEventListener('click', e => {
            e.stopPropagation();
            this.isOpen ? this._close() : this._open();
        });

        this.searchInput.addEventListener('input', () => {
            this.searchTerm = this.searchInput.value;
            this._renderOptions(this.searchTerm);
        });

        this.searchInput.addEventListener('click', e => e.stopPropagation());
        this.panel.addEventListener('click', e => e.stopPropagation());

        // Reposition on scroll/resize; close if trigger scrolls out of view
        this._onScroll = () => {
            if (!this.isOpen) return;
            const rect = this.trigger.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > window.innerHeight) {
                this._close();
            } else {
                this._positionPanel();
            }
        };
        this._onResize = () => { if (this.isOpen) this._positionPanel(); };

        window.addEventListener('scroll', this._onScroll, { passive: true, capture: true });
        window.addEventListener('resize', this._onResize, { passive: true });

        document.addEventListener('click', () => this._close());
    }

    refresh() {
        this._renderOptions(this.searchTerm);
        this._updateTrigger();
    }

    setValue(value) {
        this.select.value = value;
        this._updateTrigger();
    }

    destroy() {
        window.removeEventListener('scroll', this._onScroll, { capture: true });
        window.removeEventListener('resize', this._onResize);
        this.panel.remove();
        this.wrapper.remove();
    }
}

// Will be called manually from app.js after populating options
window.CustomSelect = CustomSelect;
