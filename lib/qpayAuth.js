// lib/qpayAuth.js
// QPay-ийн зөвлөмжийн дагуу: access token-ыг ХУГАЦААНДАА ЗӨВХӨН НЭГ УДАА авч,
// дуусах хүртэл дахин ашиглана.

let cachedToken = null;
let cachedExpiryMs = 0;

function decodeJwtExpiry(token) {
  try {
    const payloadB64 = token.split('.')[1];
    const json = Buffer.from(payloadB64, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export async function getQpayToken() {
  const now = Date.now();

  if (cachedToken && now < cachedExpiryMs - 60000) {
    return cachedToken;
  }

  const baseUrl  = process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn/v2';
  const username = process.env.QPAY_USERNAME;
  const password = process.env.QPAY_PASSWORD;

  if (!username || !password) {
    throw new Error('QPAY_USERNAME / QPAY_PASSWORD орчны хувьсагч тохируулагдаагүй байна.');
  }

  const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
  const resp = await fetch(`${baseUrl}/auth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json'
    }
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error('QPay auth амжилтгүй: ' + t);
  }

  const data = await resp.json();
  cachedToken = data.access_token;

  const exp = decodeJwtExpiry(cachedToken);
  cachedExpiryMs = exp || (now + 50 * 60 * 1000);

  return cachedToken;
}

export function getQpayBaseUrl() {
  return process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn/v2';
}
