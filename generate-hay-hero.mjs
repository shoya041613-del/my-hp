import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateImage() {
  const prompt = `
Interior lifestyle photography in the style of HAY Denmark / Scandinavian minimal design.
Scene: A dining area with a round natural oak wood table with splayed angled legs (similar to HAY Snaregade table).
Two white molded shell chairs with natural wood legs are placed around the table (similar to HAY About a Chair AAC).
Pure white walls. Light blonde hardwood floor. A natural fiber jute/sisal rug under the table.
Soft natural daylight streaming in from a window on the right side, casting gentle shadows.
A small black and white cat is sitting on the floor near the table.
The overall mood is calm, clean, airy, Nordic minimal. No clutter. Very simple decor.
Shot from a slightly elevated angle showing the full table and chairs.
Color palette: white, natural oak beige, warm light. Photo-realistic, high quality.
  `.trim();

  console.log("画像生成中...");

  const response = await client.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1792x1024",
    quality: "hd",
    response_format: "b64_json",
  });

  const imageData = response.data[0].b64_json;
  fs.writeFileSync(
    "public/hay-hero.png",
    Buffer.from(imageData, "base64")
  );
  console.log("✅ public/hay-hero.png に保存しました！");
  console.log("revised_prompt:", response.data[0].revised_prompt?.slice(0, 200));
}

generateImage().catch(console.error);
