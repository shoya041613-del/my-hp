/**
 * Vercel サーバーレス関数：ÉPURE お問い合わせメール送信
 */

const nodemailer = require('nodemailer');

// カテゴリーの日本語変換マップ
const CATEGORY_MAP = {
  return:   '返品・交換について',
  repair:   '修理・メンテナンス',
  order:    'オーダーメイド・特注',
  product:  '商品・在庫のお問い合わせ',
  shipping: '配送・お届けについて',
  other:    'その他',
};

module.exports = async (req, res) => {
  // CORS ヘッダー
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, category, message } = req.body;

  // バリデーション
  if (!name || !email || !category || !message) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    return res.status(500).json({ error: 'メール設定が未完了です' });
  }

  const categoryLabel = CATEGORY_MAP[category] || category;

  // Nodemailer トランスポーター（Gmail SMTP）
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"ÉPURE お問い合わせ" <${process.env.GMAIL_USER}>`,
    to:   process.env.GMAIL_USER,
    replyTo: email,
    subject: `【ÉPURE】お問い合わせ：${categoryLabel}（${name} 様）`,
    text: [
      `■ お名前: ${name}`,
      `■ メールアドレス: ${email}`,
      `■ 種別: ${categoryLabel}`,
      `■ メッセージ:\n${message}`,
    ].join('\n\n'),
    html: `
      <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;color:#2a2826;">
        <div style="background:#2a2826;padding:24px 32px;">
          <p style="font-family:Georgia,serif;font-size:20px;letter-spacing:0.2em;color:#f5f3ef;margin:0;">É P U R E</p>
          <p style="font-size:11px;color:rgba(245,243,239,0.5);margin:4px 0 0;letter-spacing:0.15em;">NEW INQUIRY</p>
        </div>
        <div style="padding:32px;background:#f5f3ef;border:1px solid #eceae6;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:12px 0;border-bottom:1px solid #eceae6;font-size:11px;color:#8a8680;letter-spacing:0.1em;width:140px;">お名前</td><td style="padding:12px 0;border-bottom:1px solid #eceae6;font-size:13px;">${name}</td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid #eceae6;font-size:11px;color:#8a8680;letter-spacing:0.1em;">メールアドレス</td><td style="padding:12px 0;border-bottom:1px solid #eceae6;font-size:13px;"><a href="mailto:${email}" style="color:#2a2826;">${email}</a></td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid #eceae6;font-size:11px;color:#8a8680;letter-spacing:0.1em;">お問い合わせ種別</td><td style="padding:12px 0;border-bottom:1px solid #eceae6;font-size:13px;">${categoryLabel}</td></tr>
          </table>
          <div style="margin-top:24px;">
            <p style="font-size:11px;color:#8a8680;letter-spacing:0.1em;margin-bottom:10px;">メッセージ</p>
            <p style="font-size:13px;line-height:1.9;white-space:pre-wrap;">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
          </div>
        </div>
        <div style="padding:16px 32px;background:#eceae6;">
          <p style="font-size:10px;color:#8a8680;margin:0;">このメールは ÉPURE ウェブサイトのお問い合わせフォームより自動送信されました。</p>
        </div>
      </div>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ ok: true });
  } catch (err) {
    console.error('メール送信エラー:', err.message);
    res.status(500).json({ error: 'メールの送信に失敗しました。しばらくしてから再度お試しください。' });
  }
};
