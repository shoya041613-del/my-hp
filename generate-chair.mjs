import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateImage() {
  const prompt = `
Professional product photography of a single modern designer chair.
The chair has a dusty blue/muted blue plastic molded shell seat and backrest, with natural light wood legs in a simple four-leg design.
Shot straight-on from a slight angle, full chair visible with empty space around it.
Background: very clean, flat light gray (#f0eeec) studio background, seamless.
Lighting: soft, even, diffused studio lighting with no harsh shadows. Subtle soft shadow beneath the chair.
Style: exactly like HAY or Muuto furniture catalog product photography. Minimal, clean, Scandinavian.
No text, no props, no people. Just the chair on clean gray background.
High resolution, photorealistic.
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
      fs.writeFileSync("chair-product.png", Buffer.from(imageData, "base64"));
      console.log("✅ chair-product.png に保存しました！");
      return;
    }
  }
  console.log("画像なし");
  console.log(JSON.stringify(response, null, 2));
}

generateImage().catch(console.error);
