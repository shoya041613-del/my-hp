/**
 * ÉPURE ブランドコンシェルジュ チャットAPIサーバー
 * Claude を使ったストリーミング応答を提供する
 */

const fs   = require('fs');
const path = require('path');

// .env ファイルを直接パースして環境変数に設定
// （シェルの dotenvx インターセプトを回避するため fs で直読み）
try {
  const envText = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    // 空文字の場合も含めて .env の値で上書きする
    if (key) process.env[key] = val;
  }
} catch {
  // .env が存在しない場合は既存の環境変数をそのまま使う
}

const express    = require('express');
const Anthropic  = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');

const app  = express();
app.use(express.json());

// Anthropic クライアントの初期化
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ÉPURE ブランドコンシェルジュのシステムプロンプト
const SYSTEM_PROMPT = `あなたはÉPURE（エピュール）のブランドコンシェルジュAIです。
日常の純粋な美学を追求するライフスタイルブランドとして、
訪問者に上質で洗練されたサービスをご提供ください。

【ブランドについて】
- ブランド名: ÉPURE（エピュール）
- コンセプト: 「日常の純粋な美学 — Pure Aesthetics of Everyday Life」
- デザイン哲学: 余分なものをすべて取り除き、本質だけを残す。上質な素材と精緻なクラフツマンシップが生む、静謐で普遍的な美しさ
- カテゴリー: ファッション、インテリア、フレグランスにわたるライフスタイルブランド

【コレクション概要】
- ファッション: リネン・シルク・カシミアなど上質素材を用いたミニマルウェア（¥12,000〜¥180,000）
- インテリア: 生活空間に静謐な美を添えるホームウェア（¥8,000〜¥120,000）
- フレグランス: 自然由来の原料を用いた香水・キャンドル（¥6,000〜¥48,000）
- ジュエリー: シンプルな造形に宿る永続的な価値（¥15,000〜¥280,000）

【対応方針】
- 上品で洗練された日本語でお答えください
- 日本語でのご質問には日本語で、英語でのご質問には英語でお答えください
- 簡潔かつ的確に、200文字以内でお答えください
- 掲載されていない詳細についてはお問い合わせフォームまたはストアへのご来店をご案内ください
- 絵文字は使わず、品のある文体を維持してください
- ÉPUREのブランド価値観（純粋・静謐・本質）を体現したトーンでお話しください
- 過剰な表現を避け、簡潔で誠実な接客スタイルを心がけてください

【エスカレーション】
以下のような場合は、回答の末尾に必ず「[[ESCALATE]]」というテキストを付加してください：
- ブランドや商品に関する詳細な問い合わせでAIでは対応できないと判断した場合
- クレーム・返品・修理・オーダーメイドなど個別対応が必要な場合
- 価格交渉・特別対応のご要望
- その他、担当スタッフへの引き継ぎが適切と判断した場合
「[[ESCALATE]]」は必ず文末に付加し、それ以外の場所には絶対に使用しないこと。`;

/**
 * POST /api/chat
 * リクエストボディ: { messages: [{role, content}] }
 * レスポンス: SSE ストリーム（text/event-stream）
 */
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  // バリデーション
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages は必須の配列です' });
  }

  // APIキーの確認
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY が設定されていません' });
  }

  // SSE ヘッダーを設定
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    // Claude API にストリーミングリクエストを送信
    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: messages,
    });

    // テキストデルタをSSEで順次送信
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    // ストリーム完了を通知
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Claude API エラー:', error.status ?? '', error.message);

    // エラー内容に応じてユーザー向けメッセージを出し分ける
    let userMsg = '申し訳ございません。一時的な問題が発生しております。しばらくしてから再度お試しください。';

    const status  = error.status;
    const message = (error.message ?? '').toLowerCase();

    if (status === 429 || message.includes('rate_limit') || message.includes('you\'ve hit your limit') || message.includes('resets')) {
      // レート制限 / 利用上限超過
      userMsg = '現在、アクセスが集中しております。しばらく時間をおいてから再度お試しください。';
    } else if (status === 529 || message.includes('overloaded')) {
      // API サーバー過負荷
      userMsg = 'AIサービスが一時的に混雑しております。少し後ほど再度お試しください。';
    } else if (message.includes('credit balance') || message.includes('billing')) {
      // クレジット残高不足
      userMsg = '現在AIチャットをご利用いただけません。お問い合わせは下部のフォームをご利用ください。';
    } else if (message.includes('invalid_api_key') || message.includes('authentication')) {
      // APIキー不正
      userMsg = 'AIサービスの設定に問題があります。管理者にお問い合わせください。';
    }

    // SSE ヘッダー送信済みか確認してからレスポンスを書き込む
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
    }
    res.write(`data: ${JSON.stringify({ error: userMsg })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

/**
 * POST /api/contact
 * お問い合わせフォームのメール送信
 * リクエストボディ: { name, email, category, message }
 */
app.post('/api/contact', async (req, res) => {
  const { name, email, category, message } = req.body;

  // バリデーション
  if (!name || !email || !category || !message) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  // Gmail の認証情報確認
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    return res.status(500).json({ error: 'メール設定が未完了です' });
  }

  // カテゴリーの日本語変換
  const categoryMap = {
    return:   '返品・交換について',
    repair:   '修理・メンテナンス',
    order:    'オーダーメイド・特注',
    product:  '商品・在庫のお問い合わせ',
    shipping: '配送・お届けについて',
    other:    'その他',
  };
  const categoryLabel = categoryMap[category] || category;

  // Nodemailer トランスポーター（Gmail SMTP）
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  // メール本文
  const mailOptions = {
    from: `"ÉPURE お問い合わせ" <${process.env.GMAIL_USER}>`,
    to:   process.env.GMAIL_USER,   // 受信先（自分のGmail）
    replyTo: email,                 // 返信先はお客様のメアド
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
});

// ヘルスチェック用エンドポイント
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', model: 'claude-opus-4-7' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ ÉPURE コンシェルジュサーバー起動中: http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY が設定されていません。.env ファイルを確認してください。');
  }
});
