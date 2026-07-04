// api/qpay-callback.js
// QPay төлбөр хийгдэх бүрт ЭНЭ URL руу callback (webhook) илгээдэг.
// QPay-ийн зөвлөмжийн дагуу: callback ирсний дараа АЛГА ҮГҮЙ дахин
// /payment/check дуудаж, төлбөрийг ӨӨРСДӨӨ баталгаажуулна —
// callback-ийн агуулгыг шууд итгэмжлэхгүй (аюулгүй байдлын шаардлага).

import { getQpayToken, getQpayBaseUrl } from '../lib/qpayAuth.js';

export default async function handler(req, res) {
  try {
    // QPay callback_url-руу ихэвчлэн GET-ээр ирдэг (бидний илгээсэн query параметртэйгээ)
    const senderInvoiceNo = req.query?.sender_invoice_no;
    const invoiceId =
      req.query?.invoice_id ||
      req.query?.object_id ||
      (req.body && (req.body.invoice_id || req.body.object_id));

    // Анхаарах зүйл: database байхгүй тул sender_invoice_no -> invoice_id
    // холбоосыг энд бид хадгалаагүй. Иймд QPay callback нь invoice_id-г
    // шууд дамжуулаагүй тохиолдолд бид зөвхөн ирсэн эсэхийг лог хийж,
    // бодит баталгаажуулалтыг фронт-эндийн /api/qpay-check polling дээр найдна
    // (энэ бол одоогийн зохион байгуулалтын гол баталгаажуулах механизм).
    if (!invoiceId) {
      console.log('QPay callback ирлээ. sender_invoice_no =', senderInvoiceNo);
      return res.status(200).json({ received: true, verified: false, sender_invoice_no: senderInvoiceNo || null });
    }

    const token = await getQpayToken();
    const baseUrl = getQpayBaseUrl();

    const checkResp = await fetch(`${baseUrl}/payment/check`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        object_type: 'INVOICE',
        object_id: invoiceId,
        offset: { page_number: 1, page_limit: 100 }
      })
    });

    const checkData = await checkResp.json();
    const paid = (checkData.count || 0) > 0 &&
      (checkData.rows || []).some(r => r.payment_status === 'PAID');

    console.log(`QPay callback: invoice=${invoiceId} paid=${paid}`);

    return res.status(200).json({ received: true, verified: paid });
  } catch (err) {
    console.error('QPay callback error:', err);
    return res.status(200).json({ received: true, verified: false, error: err.message });
  }
}
