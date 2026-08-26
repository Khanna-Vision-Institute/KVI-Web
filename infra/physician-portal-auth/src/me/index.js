/**
 * Minimal profile derived from JWT claims validated by API Gateway JWT authorizer.
 * Access-token claims omit email unless your pool adds resource-server scopes — see docs.
 */

const DEFAULT_HEADERS = Object.freeze({
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, max-age=0, no-store',
});

function corsAllowOrigin(headers) {
  const allowPrimary = process.env.ALLOW_ORIGIN_PRIMARY || 'https://khannainstitute.com';
  const allowWww = process.env.ALLOW_ORIGIN_WWW || 'https://www.khannainstitute.com';
  const incoming = headers?.origin || headers?.Origin || '';

  let allow = allowPrimary;
  if (incoming && (incoming === allowPrimary || incoming === allowWww)) {
    allow = incoming;
  }
  return allow;
}

function pickClaims(claimsRaw) {
  if (!claimsRaw || typeof claimsRaw !== 'object') return {};
  const out = {};

  const keys = [
    'sub',
    'username',
    'email',
    'email_verified',
    'given_name',
    'family_name',
    'cognito:username',
    'auth_time',
    'token_use',
    'iat',
    'exp',
    'scope',
    'client_id',
  ];

  keys.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(claimsRaw, k)) {
      out[k] = claimsRaw[k];
    }
  });

  if (!out.username && typeof out['cognito:username'] === 'string')
    out.username = out['cognito:username'];
  return out;
}

/** @type {import('aws-lambda').APIGatewayProxyHandlerV2} */
export async function handler(event, context) {
  void context;

  try {
    const headers = event.headers || {};
    const allow = corsAllowOrigin(headers);

    const claims = /** @type {Record<string, unknown>} */ (
      event.requestContext?.authorizer?.jwt?.claims ?? {}
    );
    const safe = pickClaims(claims);

    const body = {
      ok: true,
      physician: safe,
      receivedAt: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers: {
        ...DEFAULT_HEADERS,
        'Access-Control-Allow-Origin': allow,
      },
      body: JSON.stringify(body),
    };
  } catch (e) {
    const headers = event.headers || {};
    const allow = corsAllowOrigin(headers);

    console.error('[me]', e instanceof Error ? e.stack || e.message : e);

    return {
      statusCode: 500,
      headers: {
        ...DEFAULT_HEADERS,
        'Access-Control-Allow-Origin': allow,
      },
      body: JSON.stringify({
        ok: false,
        message: 'Unable to assemble profile.',
      }),
    };
  }
}
