/**
 * Vercel サーバーレス関数：ÉPURE ブランドコンシェルジュ チャットAPI
 * SSE ストリーミング形式でレスポンスを返す
 */

const Anthropic = require('@anthropic-ai/sdk');

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
- 過剰な表現を避け、簡潔で誠実な接客スタイルを心がけてください`;

module.exports = async (req, res) => {
  // CORS ヘッダー
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // プリフライトリクエスト対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST 以外は拒否
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  // バリデーション
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages は必須の配列です' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    // SSE 形式でエラーを返す
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ error: '現在コンシェルジュサービスをご利用いただけません。しばらくしてから再度お試しください。' })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // SSE ヘッダーを設定
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Claude API にストリーミングリクエストを送信
    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages,
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
    console.error('Claude API エラー:', error.message);

    let userMsg = '申し訳ございません。一時的な問題が発生しております。しばらくしてから再度お試しください。';
    if (error.message?.includes('credit balance') || error.message?.includes('billing')) {
      userMsg = '現在コンシェルジュサービスをご利用いただけません。お問い合わせフォームよりご連絡ください。';
    } else if (error.message?.includes('invalid_api_key') || error.message?.includes('authentication')) {
      userMsg = 'システムエラーが発生しました。管理者にお問い合わせください。';
    } else if (error.status === 429) {
      userMsg = '現在アクセスが集中しております。しばらく時間をおいてから再度お試しください。';
    }

    res.write(`data: ${JSON.stringify({ error: userMsg })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
};
