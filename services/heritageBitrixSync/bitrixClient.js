/**
 * Minimal Bitrix24 REST client for Doctor Office SPA items (crm.item.*).
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { heritageBitrixSyncConfig } = require('./fieldMapping');

/**
 * Flatten nested params for Bitrix form posts: { order: { id: 'ASC' } } → order[id]=ASC
 * @param {Record<string, unknown>} params
 * @param {string} [prefix]
 * @param {URLSearchParams} [out]
 */
function appendParams(params, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params || {})) {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          appendParams(item, `${name}[${i}]`, out);
        } else {
          out.append(`${name}[${i}]`, String(item));
        }
      });
    } else if (typeof value === 'object') {
      appendParams(/** @type {Record<string, unknown>} */ (value), name, out);
    } else {
      out.append(name, String(value));
    }
  }
  return out;
}

/**
 * @param {string} method e.g. crm.item.list
 * @param {Record<string, unknown>} params
 */
function bitrixCall(method, params = {}) {
  const cfg = heritageBitrixSyncConfig();
  if (!cfg.webhookUrl) {
    return Promise.reject(new Error('BITRIX_WEBHOOK_URL is not set'));
  }

  const endpoint = new URL(method.replace(/^\//, ''), cfg.webhookUrl);
  const payload = appendParams(params).toString();

  return new Promise((resolve, reject) => {
    const lib = endpoint.protocol === 'http:' ? http : https;
    const req = lib.request(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 60000,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let data;
          try {
            data = JSON.parse(raw || '{}');
          } catch (err) {
            reject(new Error(`Bitrix non-JSON response (${res.statusCode}): ${raw.slice(0, 200)}`));
            return;
          }
          if (data.error) {
            reject(
              new Error(
                `Bitrix ${method}: ${data.error}${data.error_description ? ` — ${data.error_description}` : ''}`
              )
            );
            return;
          }
          // Bitrix puts pagination (`next`, `total`) on the response root, not inside `result`.
          resolve({
            result: data.result,
            next: data.next,
            total: data.total,
          });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Bitrix ${method} timed out`));
    });
    req.write(payload);
    req.end();
  });
}

/**
 * Fetch all Doctor Office items (entityTypeId default 1038).
 * @param {{ entityTypeId?: number, pageSize?: number, logger?: Pick<Console, 'info' | 'warn'> }} [opts]
 */
async function listAllDoctorOfficeItems(opts = {}) {
  const cfg = heritageBitrixSyncConfig();
  const entityTypeId = opts.entityTypeId || cfg.entityTypeId;
  const logger = opts.logger || console;

  /** @type {Record<string, unknown>[]} */
  const all = [];
  let start = 0;
  let page = 0;

  for (;;) {
    page += 1;
    const envelope = await bitrixCall('crm.item.list', {
      entityTypeId,
      order: { id: 'ASC' },
      start,
    });

    const result = envelope && envelope.result;
    const items = (result && result.items) || [];
    if (!Array.isArray(items) || !items.length) break;

    all.push(...items);
    const totalHint =
      typeof envelope.total === 'number' ? ` / ${envelope.total}` : '';
    logger.info(
      '[heritage-bitrix-sync] Fetched page',
      page,
      'items',
      items.length,
      'total',
      `${all.length}${totalHint}`
    );

    if (typeof envelope.next === 'number') {
      start = envelope.next;
      continue;
    }
    // Fallback if `next` missing but more pages remain
    if (typeof envelope.total === 'number' && all.length < envelope.total && items.length > 0) {
      start = all.length;
      continue;
    }
    break;
  }

  return all;
}

module.exports = {
  bitrixCall,
  listAllDoctorOfficeItems,
};
