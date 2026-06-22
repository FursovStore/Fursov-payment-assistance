// App (ESM): country selector, clipboard, toasts, hash/query routing, bookmarklets
import { createConsoleCode, createBookmarklet } from './payment-codes.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// — Toast —

function toast(msg, { timeout = 2200 } = {}) {
  const wrap = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), timeout);
}

// — Clipboard —

async function writeClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

// — Plan identifiers —

const PLUS_PLANS = ['chatgptplusplan', 'chatgptplus'];
const PRO_PLANS  = ['chatgptpro', 'chatgptproplan'];

// — Country / billing state —

const DEFAULT_US  = { country: 'US', currency: 'USD', label: 'US USD' };
const DEFAULT_TL  = { country: 'TL', currency: 'PHP', label: 'TL PHP' };

let billingUS     = { ...DEFAULT_US };
let billingAlt    = { ...DEFAULT_TL };
let billingCustom = { ...DEFAULT_US };

function billingFromCountry(entry, currency) {
  const cur = currency ?? entry.currency;
  return {
    country:  entry.openai_code ?? entry.code,
    currency: cur,
    label:    `${entry.openai_code ?? entry.code} ${cur}`,
  };
}


// — Countries data (cached) —

let countriesData = [];

async function loadCountries() {
  const cached  = localStorage.getItem('countriesData');
  const cacheTs = localStorage.getItem('countriesCacheTime');
  const TTL     = 7 * 24 * 60 * 60 * 1000;

  if (cached && cacheTs && Date.now() - Number(cacheTs) < TTL) {
    countriesData = JSON.parse(cached);
    return;
  }

  try {
    const res  = await fetch('countries-currencies.json');
    const data = await res.json();
    countriesData = data.countries;
    localStorage.setItem('countriesData', JSON.stringify(countriesData));
    localStorage.setItem('countriesCacheTime', String(Date.now()));
  } catch {
    // fall back to defaults
  }
}

// — Country / currency selector UI —

function buildCountrySelect() {
  const select = $('#countrySelect');
  if (!select || !countriesData.length) return;

  const sorted = [...countriesData].sort((a, b) =>
    a.name_ru.localeCompare(b.name_ru, 'ru')
  );
  sorted.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code;
    const displayCode = c.openai_code ?? c.code;
    opt.textContent = `${c.name_ru} (${displayCode} · ${c.currency} ${c.symbol})`;
    select.appendChild(opt);
  });
}

function buildCurrencySelect() {
  const select = $('#currencySelect');
  if (!select || !countriesData.length) return;

  select.innerHTML = '';
  const seen = new Set();
  const sorted = [...countriesData].sort((a, b) => a.currency.localeCompare(b.currency));
  sorted.forEach(c => {
    if (seen.has(c.currency)) return;
    seen.add(c.currency);
    const opt = document.createElement('option');
    opt.value = c.currency;
    opt.textContent = `${c.currency} — ${c.currency_name_ru} (${c.symbol})`;
    if (c.currency === 'USD') opt.selected = true;
    select.appendChild(opt);
  });
}

function getCountryByCode(code) {
  const upper = (code || '').toUpperCase();
  return countriesData.find(c => c.code === upper || c.openai_code === upper) ?? null;
}

// — URL parameter ?c=XX —

function readURLCountry() {
  return new URLSearchParams(location.search).get('c') || null;
}

function updateURLParam(code) {
  const url = new URL(location.href);
  if (code) url.searchParams.set('c', code);
  else url.searchParams.delete('c');
  history.replaceState(null, '', url.toString());
}

// — Code generators —

function planPlans(plan) { return plan === 'pro' ? PRO_PLANS : PLUS_PLANS; }

// — Refresh bookmarklet hrefs and custom labels —

function refreshAllButtons() {
  const planSel = $('#planSelect');
  const plans   = planPlans(planSel?.value ?? 'plus');
  const planLabel = (planSel?.value === 'pro') ? 'Pro' : 'Plus';

  const bookmarkMap = [
    ['[data-bookmarklet-plus-us]', createBookmarklet(PLUS_PLANS, billingUS)],
    ['[data-bookmarklet-plus-tl]', createBookmarklet(PLUS_PLANS, billingAlt)],
    ['[data-bookmarklet-pro-us]',  createBookmarklet(PRO_PLANS,  billingUS)],
    ['[data-bookmarklet-pro-tl]',  createBookmarklet(PRO_PLANS,  billingAlt)],
    ['[data-bookmarklet-custom]',  createBookmarklet(plans,      billingCustom)],
  ];
  bookmarkMap.forEach(([sel, href]) => {
    const el = $(sel);
    if (el) { try { el.setAttribute('href', href); } catch {} }
  });

  $$('[data-custom-label]').forEach(el => {
    el.textContent = `${planLabel} · ${billingCustom.label}`;
  });
}

// — Click handlers —

function onClick(e) {
  const btn = e.target.closest('button, a');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  if (!action) return;
  if (btn.tagName === 'A') return;
  e.preventDefault();

  const planSel   = $('#planSelect');
  const planLabel = (planSel?.value === 'pro') ? 'Pro' : 'Plus';
  const plans     = planPlans(planSel?.value ?? 'plus');

  switch (action) {
    case 'copy-bookmarklet-plus-us':
      writeClipboard(createBookmarklet(PLUS_PLANS, billingUS))
        .then(ok => toast(ok ? `Закладка Plus · US USD скопирована` : 'Не удалось скопировать'));
      break;
    case 'copy-bookmarklet-plus-tl':
      writeClipboard(createBookmarklet(PLUS_PLANS, billingAlt))
        .then(ok => toast(ok ? `Закладка Plus · TL PHP скопирована` : 'Не удалось скопировать'));
      break;
    case 'copy-bookmarklet-pro-us':
      writeClipboard(createBookmarklet(PRO_PLANS, billingUS))
        .then(ok => toast(ok ? `Закладка Pro · US USD скопирована` : 'Не удалось скопировать'));
      break;
    case 'copy-bookmarklet-pro-tl':
      writeClipboard(createBookmarklet(PRO_PLANS, billingAlt))
        .then(ok => toast(ok ? `Закладка Pro · TL PHP скопирована` : 'Не удалось скопировать'));
      break;
    case 'copy-bookmarklet-custom':
      writeClipboard(createBookmarklet(plans, billingCustom))
        .then(ok => toast(ok ? `Закладка ${planLabel} · ${billingCustom.label} скопирована` : 'Не удалось скопировать'));
      break;
    case 'copy-console-plus-us':
      writeClipboard(createConsoleCode(PLUS_PLANS, billingUS))
        .then(ok => toast(ok ? `Код консоли Plus · US USD скопирован` : 'Не удалось скопировать'));
      break;
    case 'copy-console-plus-tl':
      writeClipboard(createConsoleCode(PLUS_PLANS, billingAlt))
        .then(ok => toast(ok ? `Код консоли Plus · TL PHP скопирован` : 'Не удалось скопировать'));
      break;
    case 'copy-console-pro-us':
      writeClipboard(createConsoleCode(PRO_PLANS, billingUS))
        .then(ok => toast(ok ? `Код консоли Pro · US USD скопирован` : 'Не удалось скопировать'));
      break;
    case 'copy-console-pro-tl':
      writeClipboard(createConsoleCode(PRO_PLANS, billingAlt))
        .then(ok => toast(ok ? `Код консоли Pro · TL PHP скопирован` : 'Не удалось скопировать'));
      break;
    case 'copy-console-custom':
      writeClipboard(createConsoleCode(plans, billingCustom))
        .then(ok => toast(ok ? `Код консоли ${planLabel} · ${billingCustom.label} скопирован` : 'Не удалось скопировать'));
      break;
    default:
      break;
  }
}

document.addEventListener('click', onClick);

// — Hash highlight (#var1 / #var2 / #var3) —

function applyHashHighlight() {
  const h = (location.hash || '').toLowerCase();
  const ids = ['#var1', '#var2', '#var3'];
  $$('.card').forEach(el => el.classList.remove('is-highlighted'));
  const idx = ids.indexOf(h);
  const targetId = idx >= 0 ? ids[idx].slice(1) : null;
  if (targetId) {
    const el = document.getElementById(targetId);
    if (el) {
      el.classList.add('is-highlighted');
      el.focus({ preventScroll: true });
      const isMobile = window.matchMedia('(max-width: 980px)').matches;
      if (isMobile) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

window.addEventListener('hashchange', applyHashHighlight);

// — Selector: country auto-fills currency (overrideable), Apply sets billingCustom —

function initCountrySelect() {
  const countrySelect  = $('#countrySelect');
  const currencySelect = $('#currencySelect');
  const planSelect     = $('#planSelect');
  const applyBtn       = $('#applySelector');

  if (countrySelect && currencySelect) {
    countrySelect.addEventListener('change', () => {
      const entry = getCountryByCode(countrySelect.value);
      if (entry) currencySelect.value = entry.currency;
    });
  }

  if (planSelect) {
    planSelect.addEventListener('change', refreshAllButtons);
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const entry    = getCountryByCode(countrySelect?.value ?? '');
      const currency = currencySelect?.value || 'USD';
      if (entry) {
        billingCustom = billingFromCountry(entry, currency);
      } else {
        billingCustom = { country: 'US', currency, label: `US ${currency}` };
      }
      refreshAllButtons();
      if (entry) updateURLParam(entry.code);
      toast(`Применено: ${billingCustom.label}`);
    });
  }

  const urlCode = readURLCountry();
  if (urlCode) {
    const entry = getCountryByCode(urlCode);
    if (entry) {
      if (countrySelect)  countrySelect.value  = entry.code;
      if (currencySelect) currencySelect.value = entry.currency;
      billingCustom = billingFromCountry(entry);
      refreshAllButtons();
    }
  }
}

// — Header sync + enhancements —

async function ensureHeader() {
  let header = document.querySelector('.site-header');
  if (header) return header;
  try {
    const res = await fetch('index.html', { credentials: 'same-origin' });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const sourceHeader = doc.querySelector('.site-header');
    if (sourceHeader) {
      document.body.insertAdjacentElement('afterbegin', sourceHeader.cloneNode(true));
      return document.querySelector('.site-header');
    }
  } catch {}
  return null;
}

function initHeaderEnhancements(header) {
  const links = header?.querySelector('.links');
  if (!header || !links) return;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'chip chip--ghost header-toggle';
  toggle.setAttribute('data-action', 'toggle-header-cats');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'headerCats');
  toggle.innerHTML = '<img class="chip__icon" src="image/Icon-More-white.svg" alt="" width="16" height="16" />Больше...';
  links.appendChild(toggle);

  const cats = document.createElement('div');
  cats.id = 'headerCats';
  cats.className = 'header-cats';
  cats.setAttribute('aria-hidden', 'true');
  cats.innerHTML = `
    <div class="cats-inner">
      <section class="cat cat--sites" aria-label="Категория: Сайты">
        <h3 class="cat__title">Сайты</h3>
        <div id="catSites" class="cat__items"></div>
      </section>
      <section class="cat cat--bots" aria-label="Категория: Telegram боты">
        <h3 class="cat__title">Telegram боты</h3>
        <div class="cat__items">
          <a class="chip" href="https://t.me/ChangeSteamBot" target="_blank" rel="noopener">
            <img class="chip__icon" src="image/Icon-south-white.svg" alt="Смена региона Steam" width="16" height="16" />
            Смена региона Steam
          </a>
          <a class="chip" href="https://t.me/FursovPayBot" target="_blank" rel="noopener">
            <img class="chip__icon" src="image/Icon-card-payment-white.svg" alt="Пополнение Steam" width="16" height="16" />
            Пополнение Steam
          </a>
          <a class="chip" href="https://t.me/OplataRublemBot" target="_blank" rel="noopener">
            <img class="chip__icon" src="image/Logo-OplataRublemBot.png" alt="Оплата рублем" width="16" height="16" />
            Оплата рублем
          </a>
        </div>
      </section>
      <section class="cat cat--contact" aria-label="Категория: Связь">
        <h3 class="cat__title">Связь</h3>
        <div class="cat__items">
          <a class="chip" href="https://t.me/fursovtech" target="_blank" rel="noopener">
            <img class="chip__icon" src="image/Logo-Telegram.svg" alt="Менеджер в Telegram" width="16" height="16" />
            Менеджер в Telegram
          </a>
        </div>
      </section>
    </div>`;
  header.appendChild(cats);

  const catSites = cats.querySelector('#catSites');
  let expanded = false;

  function flipMove(elements, destination, beforeNode = null) {
    const firstRects = new Map();
    elements.forEach(el => firstRects.set(el, el.getBoundingClientRect()));
    elements.forEach(el => destination.insertBefore(el, beforeNode));
    elements.forEach(el => {
      const last  = el.getBoundingClientRect();
      const first = firstRects.get(el);
      const dx = first.left - last.left;
      const dy = first.top  - last.top;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.opacity = '0.6';
      el.getBoundingClientRect();
      el.style.transition = 'transform 400ms cubic-bezier(0.2, 0.6, 0.2, 1), opacity 400ms cubic-bezier(0.2, 0.6, 0.2, 1)';
      el.style.transform = 'translate(0,0)';
      el.style.opacity = '';
      el.addEventListener('transitionend', () => {
        el.style.transition = '';
        el.style.transform  = '';
      }, { once: true });
    });
  }

  function expand() {
    if (expanded) return;
    expanded = true;
    header.classList.add('is-expanded');
    toggle.classList.add('is-expanded');
    toggle.setAttribute('aria-expanded', 'true');
    cats.setAttribute('aria-hidden', 'false');

    const siteChips = Array.from(links.querySelectorAll('a.chip'));
    flipMove(siteChips, catSites, null);

    if (!catSites.querySelector('a.chip[href^="https://СменаРегионаСтим."]')) {
      const extra = document.createElement('a');
      extra.className = 'chip';
      extra.href      = 'https://СменаРегионаСтим.РФ';
      extra.target    = '_blank';
      extra.rel       = 'noopener';
      extra.innerHTML = '<img class="chip__icon" src="image/favicon-fursovstore.png" alt="СменаРегионаСтим.РФ" width="16" height="16" />СменаРегионаСтим.РФ';
      catSites.appendChild(extra);
    }

    if (!catSites.querySelector('a.chip[href^="https://ggsel.net"]')) {
      const ggsel = document.createElement('a');
      ggsel.className = 'chip';
      ggsel.href      = 'https://ggsel.net/sellers/164256';
      ggsel.target    = '_blank';
      ggsel.rel       = 'noopener';
      ggsel.innerHTML = '<img class="chip__icon" src="image/favicon-ggsel.ico" alt="GGSel" width="16" height="16" />GGSel';
      catSites.appendChild(ggsel);
    }
  }

  function collapse() {
    if (!expanded) return;
    expanded = false;
    header.classList.remove('is-expanded');
    toggle.classList.remove('is-expanded');
    toggle.setAttribute('aria-expanded', 'false');
    cats.setAttribute('aria-hidden', 'true');

    const siteChips = Array.from(catSites.querySelectorAll('a.chip'))
      .filter(a => !a.href.startsWith('https://СменаРегионаСтим.') && !a.href.startsWith('https://ggsel.net'));
    flipMove(siteChips, links, toggle);

    const stray1 = links.querySelector('a.chip[href^="https://СменаРегионаСтим."]');
    if (stray1) stray1.remove();

    const stray2 = links.querySelector('a.chip[href^="https://ggsel.net"]');
    if (stray2) stray2.remove();
  }

  toggle.addEventListener('click', () => (expanded ? collapse() : expand()));
}

// — Title marquee —

const BASE_TITLE = ' Fursov - your payment assistance | ';
let marquee = BASE_TITLE;
setInterval(() => {
  marquee = marquee.slice(1) + marquee[0];
  document.title = marquee;
}, 350);

// — Init —

(async () => {
  await loadCountries();
  buildCountrySelect();
  buildCurrencySelect();
  initCountrySelect();
  refreshAllButtons();
  applyHashHighlight();

  const header = await ensureHeader();
  if (header) initHeaderEnhancements(header);
})();
