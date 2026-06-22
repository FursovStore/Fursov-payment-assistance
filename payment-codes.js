// payment-codes.js — generators for copy-to-console scripts
// Edit this file to update the script logic for all console buttons.

/**
 * @param {string[]} plans  - plan identifiers to try in order
 * @param {{ country: string, currency: string, label: string }} billing
 * @returns {string} ready-to-paste console code
 */
export function createConsoleCode(plans, billing) {
  const plansLiteral = JSON.stringify(plans);

  return `(async () => {
  try {
    console.log('\\uD83D\\uDD04 Получение токена авторизации...');

    const authReq = await fetch('/api/auth/session', { credentials: 'include' });
    if (!authReq.ok) throw new Error('Ошибка авторизации: ' + authReq.status);

    const authToken = (await authReq.json())?.accessToken;
    if (!authToken) throw new Error('Токен не найден. Войдите в аккаунт на chatgpt.com');

    console.log('\\u2705 Токен получен');

    const plans = ${plansLiteral};
    let checkoutUrl = null;

    for (const planName of plans) {
      console.log('\\uD83D\\uDD04 Попытка: ' + planName + ' (${billing.country}/${billing.currency})...');

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
          console.warn('\\u26A0\\uFE0F План "' + planName + '" не сработал (${billing.country}/${billing.currency}): HTTP ' + res.status);
          continue;
        }

        const data = await res.json();

        // Приоритет 1: готовая ссылка от API
        if (data?.url) {
          checkoutUrl = data.url;
          console.log('\\u2705 Ссылка получена (прямая) для: ' + planName);
          break;
        }

        // Приоритет 2: сборка по новой схеме OpenAI
        if (data?.checkout_session_id && data?.processor_entity) {
          checkoutUrl = 'https://chatgpt.com/checkout/' + data.processor_entity + '/' + data.checkout_session_id;
          console.log('\\u2705 Ссылка собрана через session_id для: ' + planName);
          break;
        }

        // Приоритет 3: только session_id
        if (data?.checkout_session_id) {
          checkoutUrl = 'https://chatgpt.com/checkout/' + data.checkout_session_id;
          console.log('\\u2705 Ссылка собрана через session_id (без entity) для: ' + planName);
          break;
        }

      } catch (err) {
        console.warn('\\u26A0\\uFE0F Ошибка плана "' + planName + '": ' + err.message);
      }
    }

    if (!checkoutUrl) throw new Error('Не удалось получить ссылку (${billing.country}/${billing.currency})');

    console.log('\\n\\n');
    console.log('%c🎉 Ссылка на оплату (${billing.label}):', 'color:#10b981;font-weight:bold;font-size:14px');
    console.log('%c' + checkoutUrl, 'color:#5464eb;font-size:13px;word-break:break-all');
    console.log('\\n');

    try {
      await navigator.clipboard.writeText(checkoutUrl);
      console.log('%c\\u2705 Ссылка скопирована в буфер обмена!', 'color:#10b981;font-weight:bold');
    } catch (e) {
      console.warn('Скопируйте ссылку выше вручную');
    }

    return checkoutUrl;
  } catch (error) {
    console.error('\\u274C Ошибка:', error.message || error);
    throw error;
  }
})();`;
}

/**
 * @param {string[]} plans
 * @param {{ country: string, currency: string, label: string }} billing
 * @returns {string} bookmarklet source (not minified — toBookmarklet minifies it)
 */
export function createBookmarkletSource(plans, billing) {
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
      try {
        const res = await fetch('https://chatgpt.com/backend-api/payments/checkout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            authorization: 'Bearer ' + session.accessToken,
          },
          body: JSON.stringify({
            plan_name: planName,
            billing_details: { country: '${billing.country}', currency: '${billing.currency}' },
            promo_code: null,
            checkout_ui_mode: 'redirect',
          }),
        });

        const data = await res.json();

        if (data?.url) { url = data.url; break; }
        if (data?.checkout_session_id && data?.processor_entity) {
          url = 'https://chatgpt.com/checkout/' + data.processor_entity + '/' + data.checkout_session_id;
          break;
        }
        if (data?.checkout_session_id) {
          url = 'https://chatgpt.com/checkout/' + data.checkout_session_id;
          break;
        }
      } catch (e) { continue; }
    }

    if (!url) { alert('Не удалось получить ссылку.'); return; }

    prompt('Скопируйте ссылку на оплату (${billing.label}):', url);
  } catch (error) {
    alert('✖️ Ошибка: ' + (error?.message || error));
  }
})();`;
}

export function toBookmarklet(source) {
  return 'javascript:' + source.replace(/\n\s*/g, ' ').trim();
}

export function createBookmarklet(plans, billing) {
  return toBookmarklet(createBookmarkletSource(plans, billing));
}
