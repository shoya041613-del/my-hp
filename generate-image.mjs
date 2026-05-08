import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateImage() {
  const prompt = `
A professional product mockup photo showing a large monitor/laptop screen and a smartphone side by side in a warm modern living room interior.
The monitor displays an AI chatbot interface with a floating chat window showing Japanese conversation bubbles: user asking "料金を教えてください" and AI responding "月額3万円〜です！", with an input field at the bottom saying "メッセージを入力...".
The smartphone shows the same chatbot interface in a smaller view.
Large Japanese text "チャットボット付きHP" displayed prominently above the devices.
Background: cozy living room with wooden floor, beige sofa, sheer curtains, warm ambient lighting.
Photorealistic, cinematic lighting, high quality, 16:9 aspect ratio.
  `.trim();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
    config: {
      responseModalities: ["IMAGE"],
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const imageData = part.inlineData.data;
      fs.writeFileSync("output.png", Buffer.from(imageData, "base64"));
      console.log("✅ 画像を output.png に保存しました！");
      return;
    }
  }
  console.log("画像が生成されませんでした");
  console.log(JSON.stringify(response, null, 2));
}

generateImage().catch(console.error);
