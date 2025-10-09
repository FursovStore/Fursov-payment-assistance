// App (ESM): clipboard, toasts, hash highlight, and actions per variants

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function toast(msg, { timeout = 2200 } = {}) {
  const wrap = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), timeout);
}

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

// Bookmarklet code (as specified, with prompt)
const BOOKMARKLET_SPEC = "javascript:(async()=>{try{const s=await fetch('/api/auth/session',{credentials:'include'});const j=await s.json();if(!j?.accessToken){alert('Зайдите на chatgpt.com под своим аккаунтом и попробуйте снова');return}const a={plan_name:'chatgptplusplan',billing_details:{country:'US',currency:'USD'},promo_code:null,checkout_ui_mode:'redirect'};const r=await fetch('https://chatgpt.com/backend-api/payments/checkout',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','authorization':'Bearer '+j.accessToken},body:JSON.stringify(a)});const d=await r.json();if(!d?.url){alert('Не удалось получить ссылку. Возможно включён новый метод оплаты.');return}prompt('Скопируйте ссылку на оплату (старого образца):',d.url);}catch(e){alert('Ошибка: '+(e&&e.message?e.message:e))}})();";

// Console code: lazy-load from file
let CONSOLE_CODE_CACHE = null;
async function loadConsoleCode() {
  if (CONSOLE_CODE_CACHE) return CONSOLE_CODE_CACHE;
  try {
    const res = await fetch('playcode-code-for-console.txt');
    CONSOLE_CODE_CACHE = await res.text();
  } catch {
    CONSOLE_CODE_CACHE = '';
  }
  return CONSOLE_CODE_CACHE;
}

// Hash highlight (#var1/#var2/#var3)
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
      if (isMobile) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
}
window.addEventListener('hashchange', applyHashHighlight);

// Variant 3 helpers
let lastToken = '';
function parseSessionJson() {
  const raw = $('#sessionJson').value.trim();
  if (!raw) { $('#sessionStatus').textContent = 'Вставьте JSON из /api/auth/session'; return; }
  try {
    const obj = JSON.parse(raw);
    const token = obj?.accessToken || '';
    if (!token) throw new Error('accessToken не найден');
    lastToken = token;
    $('#sessionStatus').textContent = 'Токен найден и готов к использованию.';
    $('[data-action="copy-token"]').disabled = false;
    $('[data-action="copy-api-code"]').disabled = false;
    toast('Токен найден');
  } catch (e) {
    lastToken = '';
    $('#sessionStatus').textContent = 'Ошибка: ' + e.message;
    $('[data-action="copy-token"]').disabled = true;
    $('[data-action="copy-api-code"]').disabled = true;
  }
}

function buildApiCodeFromToken(token) {
  return `const a = {
  plan_name: 'chatgptplusplan',
  billing_details: { country: 'US', currency: 'USD' },
  promo_code: null,
  checkout_ui_mode: 'redirect'
};

const token = '${token}';
const res = await fetch("https://chatgpt.com/backend-api/payments/checkout", {
  body: JSON.stringify(a),
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json", "authorization": \`Bearer \${token}\` }
});
const data = await res.json();
data.url;`;
}

// Click handlers
function onClick(e) {
  const btn = e.target.closest('button, a');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  if (!action) return;
  if (btn.tagName === 'A') return; // allow normal links
  e.preventDefault();

  switch (action) {
    case 'copy-bookmarklet':
      writeClipboard(BOOKMARKLET_SPEC).then(ok => toast(ok ? 'Код закладки скопирован' : 'Не удалось скопировать'));
      break;
    case 'copy-console':
      loadConsoleCode()
        .then(code => writeClipboard(code))
        .then(ok => toast(ok ? 'Код для консоли скопирован' : 'Не удалось скопировать'));
      break;
    case 'parse-json':
      parseSessionJson();
      break;
    case 'clear-json':
      $('#sessionJson').value = '';
      lastToken = '';
      $('#sessionStatus').textContent = '';
      $('[data-action="copy-token"]').disabled = true;
      $('[data-action="copy-api-code"]').disabled = true;
      toast('Поле очищено');
      break;
    case 'copy-token':
      if (!lastToken) return;
      writeClipboard(lastToken).then(ok => toast(ok ? 'accessToken скопирован' : 'Не удалось скопировать'));
      break;
    case 'copy-api-code':
      if (!lastToken) return;
      writeClipboard(buildApiCodeFromToken(lastToken)).then(ok => toast(ok ? 'Код запроса скопирован' : 'Не удалось скопировать'));
      break;
    case 'send-to-manager': {
      const raw = $('#sessionJson').value.trim();
      if (!raw) { toast('Поле пустое — вставьте JSON'); return; }
      const wrapped = '```\n' + raw + '\n```';
      writeClipboard(wrapped).then(() => {
        toast('Скопировано. Открываю Telegram менеджера...');
        window.open('https://t.me/fursovtech', '_blank');
      });
      break;
    }
    default:
      break;
  }
}

document.addEventListener('click', onClick);

// Init
applyHashHighlight();

// Title marquee (cyclic scrolling in the tab)
const BASE_TITLE = ' Fursov - your payment assistance | ';
let marquee = BASE_TITLE;
setInterval(() => {
  marquee = marquee.slice(1) + marquee[0];
  document.title = marquee;
}, 350);

// Inject bookmarklet href for drag-to-bookmarks link
(() => {
  const link = document.querySelector('[data-bookmarklet]');
  if (link) {
    try { link.setAttribute('href', BOOKMARKLET_SPEC); } catch {}
  }
})();

// Ensure a synchronized header across all pages by cloning from index.html if missing
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
      header = document.querySelector('.site-header');
      return header;
    }
  } catch {}
  return null;
}

function initHeaderEnhancements(header) {
  const links = header?.querySelector('.links');
  if (!header || !links) return;

  // Create toggle button
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'chip chip--ghost header-toggle';
  toggle.setAttribute('data-action', 'toggle-header-cats');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'headerCats');
  toggle.textContent = 'Больше... 👀';
  links.appendChild(toggle);

  // Build categories panel under header
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
  let extraSiteAdded = false;

  // FLIP helper for smooth chip movement
  function flipMove(elements, destination, beforeNode = null) {
    const firstRects = new Map();
    elements.forEach(el => firstRects.set(el, el.getBoundingClientRect()));
    elements.forEach(el => destination.insertBefore(el, beforeNode));
    elements.forEach(el => {
      const last = el.getBoundingClientRect();
      const first = firstRects.get(el);
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.opacity = '0.6';
      // force reflow
      el.getBoundingClientRect();
      el.style.transition = 'transform var(--dur) var(--ease), opacity var(--dur) var(--ease)';
      el.style.transform = 'translate(0,0)';
      el.style.opacity = '';
      el.addEventListener('transitionend', () => {
        el.style.transition = '';
        el.style.transform = '';
      }, { once: true });
    });
  }

  function expand() {
    if (expanded) return;
    expanded = true;
    header.classList.add('is-expanded');
    toggle.setAttribute('aria-expanded', 'true');
    cats.setAttribute('aria-hidden', 'false');

    // Existing site chips (exclude the toggle button and any non-link)
    const siteChips = Array.from(links.querySelectorAll('a.chip'));
    flipMove(siteChips, catSites, null);

    if (!extraSiteAdded) {
      const extra = document.createElement('a');
      extra.className = 'chip';
      extra.href = 'https://СменаРегионаСтим.РФ';
      extra.target = '_blank';
      extra.rel = 'noopener';
      extra.innerHTML = '<img class="chip__icon" src="image/favicon-fursovstore.png" alt="СменаРегионаСтим.РФ" width="16" height="16" />СменаРегионаСтим.РФ';
      catSites.appendChild(extra);
      extraSiteAdded = true;
    }
  }

  function collapse() {
    if (!expanded) return;
    expanded = false;
    header.classList.remove('is-expanded');
    toggle.setAttribute('aria-expanded', 'false');
    cats.setAttribute('aria-hidden', 'true');

    // Move chips back before toggle
    const siteChips = Array.from(catSites.querySelectorAll('a.chip'))
      .filter(a => !a.href.startsWith('https://СменаРегионаСтим.'));
    flipMove(siteChips, links, toggle);

    // Ensure the extra site remains only inside category
    const stray = links.querySelector('a.chip[href^="https://СменаРегионаСтим."]');
    if (stray) stray.remove();
  }

  toggle.addEventListener('click', () => (expanded ? collapse() : expand()));
}

// Init header sync + enhancements
(async () => {
  const header = await ensureHeader();
  if (header) initHeaderEnhancements(header);
})();
