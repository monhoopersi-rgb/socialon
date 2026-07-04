// Vercel Serverless Function
// Энэ файл нь QPay-ийн нууц мэдээллийг (username/password) хэрэглэгчийн
// browser-т ХЭЗЭЭ Ч харагдахгүйгээр серверийн орчинд ашиглана.
// Нууц утгуудыг Vercel Dashboard -> Settings -> Environment Variables хэсэгт бичнэ:
//   QPAY_USERNAME
//   QPAY_PASSWORD
//   QPAY_INVOICE_CODE
//   QPAY_BASE_URL (заавал биш)

import { getQpayToken, getQpayBaseUrl } from '../lib/qpayAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, description, senderInvoiceNo } = req.body || {};
    if (!amount || !description) {
      return res.status(400).json({ error: 'amount, description талбарууд заавал шаардлагатай' });
    }

    const invoiceCode = process.env.QPAY_INVOICE_CODE;
    if (!invoiceCode) {
      return res.status(500).json({ error: 'QPAY_INVOICE_CODE орчны хувьсагч тохируулагдаагүй байна.' });
    }

    const baseUrl = getQpayBaseUrl();
    const token = await getQpayToken(); // кэшлэгдсэн эсвэл шинэ token

    // sender_invoice_no-г эхэлж үүсгээд callback_url дотор дамжуулна
    // (invoice_id нь QPay-ээс ЭНЭ дуудалтын хариунд л ирэх тул урьдчилж мэдэхгүй)
    const mySenderInvoiceNo = senderInvoiceNo || String(Date.now());

    const invoiceResp = await fetch(`${baseUrl}/invoice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        invoice_code: invoiceCode,
        sender_invoice_no: mySenderInvoiceNo,
        invoice_receiver_code: 'terminal',
        invoice_description: description,
        amount: amount,
        callback_url: `https://socialon.online/api/qpay-callback?sender_invoice_no=${mySenderInvoiceNo}`
      })
    });

    if (!invoiceResp.ok) {
      const t = await invoiceResp.text();
      return res.status(502).json({ error: 'QPay invoice үүсгэхэд алдаа гарлаа', detail: t });
    }

    const invoiceData = await invoiceResp.json();

    return res.status(200).json({
      invoice_id: invoiceData.invoice_id,
      qr_image: invoiceData.qr_image,
      qr_text: invoiceData.qr_text,
      urls: invoiceData.urls || []
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
