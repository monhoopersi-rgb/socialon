// Vercel Serverless Function
// Front-end энэ endpoint-г 3 секунд тутам дуудаж, төлбөр орсон эсэхийг шалгана.
// Webhook заавал биш ч, бид /api/qpay-callback дээр нэмэлт баталгаажуулалт
// хийдэг болгосон. Энэ endpoint нь фронт-эндийн хувьд ГОЛ (authoritative) эх сурвалж.

import { getQpayToken, getQpayBaseUrl } from '../lib/qpayAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { invoice_id } = req.body || {};
    if (!invoice_id) {
      return res.status(400).json({ error: 'invoice_id шаардлагатай' });
    }

    const baseUrl = getQpayBaseUrl();
    const token = await getQpayToken(); // кэшлэгдсэн эсвэл шинэ token

    const checkResp = await fetch(`${baseUrl}/payment/check`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        object_type: 'INVOICE',
        object_id: invoice_id,
        offset: { page_number: 1, page_limit: 100 }
      })
    });

    if (!checkResp.ok) {
      const t = await checkResp.text();
      return res.status(502).json({ error: 'Статус шалгахад алдаа гарлаа', detail: t });
    }

    const checkData = await checkResp.json();
    const paid = (checkData.count || 0) > 0 &&
      (checkData.rows || []).some(r => r.payment_status === 'PAID');

    return res.status(200).json({
      paid,
      paid_amount: checkData.paid_amount || 0,
      count: checkData.count || 0
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
