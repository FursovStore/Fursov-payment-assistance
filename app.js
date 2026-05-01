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

// Billing presets
const BILLING_US = { country: 'US', currency: 'USD', label: 'US USD' };
const BILLING_TL = { country: 'TL', currency: 'PHP', label: 'PH PHP' };

const BOOKMARKLET_PLUS_PLANS = ['chatgptplusplan', 'chatgptplus'];
const BOOKMARKLET_PRO_PLANS = ['chatgptpro', 'chatgptproplan'];
const CONSOLE_PLUS_PLANS = ['chatgplus', 'chatgptplusplan'];
const CONSOLE_PRO_PLANS = ['chatgpro', 'chatgptpro'];

function createBookmarkletSource(plans, billing) {
  const plansLiteral = JSON.stringify(plans);

  return `(async () => {
  try {
    const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
    const session = await sessionRes.json();

    if (!session?.accessToken) {
      alert('Токен не найден. Войдите в аккаунт chatgpt.com');
      return;
    }

    const plans = ${plansLiteral};
    let url = null;

    for (const planName of plans) {
      const payload = {
        plan_name: planName,
        billing_details: { country: '${billing.country}', currency: '${billing.currency}' },
        promo_code: null,
        checkout_ui_mode: 'redirect',
      };

      try {
        const res = await fetch('https://chatgpt.com/backend-api/payments/checkout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            authorization: 'Bearer ' + session.accessToken,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data?.url) {
          url = data.url;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!url) {
      alert('Не удалось получить ссылку.');
      return;
    }

    prompt('Скопируйте ссылку на оплату (${billing.label}):', url);
  } catch (error) {
    alert('❌ Произошла ошибка: ' + (error && error.message ? error.message : error));
  }
})();`;
}

function toBookmarklet(source) {
  return 'javascript:' + source.replace(/\n\s*/g, ' ').trim();
}

function createBookmarklet(plans, billing) {
  return toBookmarklet(createBookmarkletSource(plans, billing));
}

function createConsoleCode(plans, billing) {
  const plansLiteral = JSON.stringify(plans);

  return `(async () => {
  try {
    console.log('🔄 Получение токена авторизации...');

    const authReq = await fetch('/api/auth/session', { credentials: 'include' });
    if (!authReq.ok) throw new Error('Ошибка авторизации: ' + authReq.status);

    const authToken = (await authReq.json())?.accessToken;
    if (!authToken) throw new Error('Токен не найден. Войдите в аккаунт');

    console.log('✅ Токен получен');

    const plans = ${plansLiteral};
    let checkoutUrl = null;

    for (const planName of plans) {
      console.log('🔄 Попытка получить ссылку для плана: ' + planName + ' (${billing.country}/${billing.currency})...');

      try {
        const res = await fetch('https://chatgpt.com/backend-api/payments/checkout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            authorization: 'Bearer ' + authToken,
          },
          body: JSON.stringify({
            plan_name: planName,
            billing_details: { country: '${billing.country}', currency: '${billing.currency}' },
            promo_code: null,
            checkout_ui_mode: 'redirect',
          }),
        });

        if (!res.ok) {
          console.warn('⚠️ План "' + planName + '" не сработал (${billing.country}/${billing.currency}): HTTP ' + res.status);
          continue;
        }

        const data = await res.json();
        if (data?.url) {
          checkoutUrl = data.url;
          console.log('✅ Ссылка успешно получена для плана: ' + planName + ' (${billing.country}/${billing.currency})');
          break;
        }
      } catch (err) {
        console.warn('⚠️ Ошибка при запросе плана "' + planName + '" (${billing.country}/${billing.currency}): ' + err.message);
      }
    }

    if (!checkoutUrl) throw new Error('Не удалось получить ссылку для всех планов (${billing.country}/${billing.currency})');

    console.log('\\n\\n');
    console.log('🎉 Ссылка на оплату:');
    console.log(checkoutUrl);
    console.log('\\n\\n');

    return checkoutUrl;
  } catch (error) {
    console.error('❌ Произошла ошибка:', error.message || error);
    throw error;
  }
})();`;
}

// Bookmarklet code - Plus plan (US)
const BOOKMARKLET_PLUS_US = createBookmarklet(BOOKMARKLET_PLUS_PLANS, BILLING_US);
// Bookmarklet code - Plus plan (PH)
const BOOKMARKLET_PLUS_TL = createBookmarklet(BOOKMARKLET_PLUS_PLANS, BILLING_TL);
// Bookmarklet code - Pro plan (US)
const BOOKMARKLET_PRO_US = createBookmarklet(BOOKMARKLET_PRO_PLANS, BILLING_US);
// Bookmarklet code - Pro plan (PH)
const BOOKMARKLET_PRO_TL = createBookmarklet(BOOKMARKLET_PRO_PLANS, BILLING_TL);

// Console code - Plus plan (US)
const CONSOLE_CODE_PLUS_US = createConsoleCode(CONSOLE_PLUS_PLANS, BILLING_US);
// Console code - Plus plan (PH)
const CONSOLE_CODE_PLUS_TL = createConsoleCode(CONSOLE_PLUS_PLANS, BILLING_TL);
// Console code - Pro plan (US)
const CONSOLE_CODE_PRO_US = createConsoleCode(CONSOLE_PRO_PLANS, BILLING_US);
// Console code - Pro plan (PH)
const CONSOLE_CODE_PRO_TL = createConsoleCode(CONSOLE_PRO_PLANS, BILLING_TL);
// Hash highlight (#var1/#var2)
function applyHashHighlight() {
  const h = (location.hash || '').toLowerCase();
  const ids = ['#var1', '#var2'];
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

// Click handlers
function onClick(e) {
  const btn = e.target.closest('button, a');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  if (!action) return;
  if (btn.tagName === 'A') return; // allow normal links
  e.preventDefault();

  switch (action) {
    case 'copy-bookmarklet-plus':
    case 'copy-bookmarklet-plus-us':
      writeClipboard(BOOKMARKLET_PLUS_US).then(ok => toast(ok ? 'Код закладки Plus (US USD) скопирован' : 'Не удалось скопировать'));
      break;
    case 'copy-bookmarklet-plus-tl':
      writeClipboard(BOOKMARKLET_PLUS_TL).then(ok => toast(ok ? 'Код закладки Plus (PH PHP) скопирован' : 'Не удалось скопировать'));
      break;
    case 'copy-bookmarklet-pro':
    case 'copy-bookmarklet-pro-us':
      writeClipboard(BOOKMARKLET_PRO_US).then(ok => toast(ok ? 'Код закладки Pro (US USD) скопирован' : 'Не удалось скопировать'));
      break;
    case 'copy-bookmarklet-pro-tl':
      writeClipboard(BOOKMARKLET_PRO_TL).then(ok => toast(ok ? 'Код закладки Pro (PH PHP) скопирован' : 'Не удалось скопировать'));
      break;
    case 'copy-console-plus':
    case 'copy-console-plus-us':
      writeClipboard(CONSOLE_CODE_PLUS_US).then(ok => toast(ok ? 'Код консоли Plus (US USD) скопирован' : 'Не удалось скопировать'));
      break;
    case 'copy-console-plus-tl':
      writeClipboard(CONSOLE_CODE_PLUS_TL).then(ok => toast(ok ? 'Код консоли Plus (PH PHP) скопирован' : 'Не удалось скопировать'));
      break;
    case 'copy-console-pro':
    case 'copy-console-pro-us':
      writeClipboard(CONSOLE_CODE_PRO_US).then(ok => toast(ok ? 'Код консоли Pro (US USD) скопирован' : 'Не удалось скопировать'));
      break;
    case 'copy-console-pro-tl':
      writeClipboard(CONSOLE_CODE_PRO_TL).then(ok => toast(ok ? 'Код консоли Pro (PH PHP) скопирован' : 'Не удалось скопировать'));
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

// Inject bookmarklet href for drag-to-bookmarks links
(() => {
  const bookmarkletLinks = [
    ['[data-bookmarklet-plus-us]', BOOKMARKLET_PLUS_US],
    ['[data-bookmarklet-plus-tl]', BOOKMARKLET_PLUS_TL],
    ['[data-bookmarklet-pro-us]', BOOKMARKLET_PRO_US],
    ['[data-bookmarklet-pro-tl]', BOOKMARKLET_PRO_TL],
  ];

  bookmarkletLinks.forEach(([selector, href]) => {
    const link = document.querySelector(selector);
    if (link) {
      try { link.setAttribute('href', href); } catch {}
    }
  });
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
  toggle.innerHTML = '<img class="chip__icon" src="image/Icon-More-white.svg" alt="" width="16" height="16" />Больше...';
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
      // Use longer duration for smoother animation
      el.style.transition = 'transform 400ms cubic-bezier(0.2, 0.6, 0.2, 1), opacity 400ms cubic-bezier(0.2, 0.6, 0.2, 1)';
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
    toggle.classList.add('is-expanded');
    toggle.setAttribute('aria-expanded', 'true');
    cats.setAttribute('aria-hidden', 'false');

    // Existing site chips (exclude the toggle button and any non-link)
    const siteChips = Array.from(links.querySelectorAll('a.chip'));
    flipMove(siteChips, catSites, null);

    // Add or ensure extra site is at the end
    const extraInCat = catSites.querySelector('a.chip[href^="https://СменаРегионаСтим."]');
    if (!extraInCat) {
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
    toggle.classList.remove('is-expanded');
    toggle.setAttribute('aria-expanded', 'false');
    cats.setAttribute('aria-hidden', 'true');

    // Move chips back before toggle (exclude the extra site)
    const siteChips = Array.from(catSites.querySelectorAll('a.chip'))
      .filter(a => !a.href.startsWith('https://СменаРегионаСтим.'));
    flipMove(siteChips, links, toggle);

    // Ensure the extra site remains only inside category
    const stray = links.querySelector('a.chip[href^="https://СменаРегионаСтим."]');
    if (stray) stray.remove();
    
    // Extra site stays in catSites at the end - no need to recreate
  }

  toggle.addEventListener('click', () => (expanded ? collapse() : expand()));
}

// Init header sync + enhancements
(async () => {
  const header = await ensureHeader();
  if (header) initHeaderEnhancements(header);
})();
