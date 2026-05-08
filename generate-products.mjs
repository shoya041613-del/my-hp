import fs from "fs";
import https from "https";
import http from "http";
import path from "path";

const OUTPUT_DIR = "./public/products";
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const products = [
  {
    id: "p1",
    filename: "chair-lounge.jpg",
    prompt: "Professional product photography, single minimal Scandinavian lounge chair, walnut wood legs, light beige fabric upholstery, pure white background, centered, soft diffused studio lighting, subtle ground shadow, HAY Denmark catalog style, no text, photorealistic, high resolution",
  },
  {
    id: "p2",
    filename: "cushion-linen.jpg",
    prompt: "Professional product photography, single linen cushion cover, natural beige linen fabric, neatly folded on white background, centered, soft diffused studio lighting, HAY Denmark catalog style, minimal, no text, photorealistic",
  },
  {
    id: "p3",
    filename: "vase-ceramic.jpg",
    prompt: "Professional product photography, single minimal ceramic flower vase, matte white porcelain, round shape, pure white background, centered, soft studio lighting, subtle shadow, Scandinavian minimal style, no flowers, no text, photorealistic",
  },
  {
    id: "p4",
    filename: "blanket-wool.jpg",
    prompt: "Professional product photography, single wool throw blanket, neatly folded, natural oatmeal beige color, soft texture visible, pure white background, centered, soft diffused studio lighting, Scandinavian minimal style, no text, photorealistic",
  },
  {
    id: "p5",
    filename: "lamp-floor.jpg",
    prompt: "Professional product photography, single minimal floor lamp, brass gold metal pole, white dome shade, pure white background, full lamp visible, soft studio lighting, HAY Denmark catalog style, no text, photorealistic, high resolution",
  },
  {
    id: "p6",
    filename: "sofa-walnut.jpg",
    prompt: "Professional product photography, single minimal 2.5 seater sofa, walnut wood legs, light gray fabric upholstery, pure white background, centered, soft diffused studio lighting, Scandinavian design, HAY catalog style, no text, photorealistic",
  },
  {
    id: "p7",
    filename: "mug-ceramic.jpg",
    prompt: "Professional product photography, single handmade ceramic coffee mug, matte off-white glaze, slight imperfections, pure white background, centered, soft natural lighting, Scandinavian minimal style, no text, photorealistic",
  },
  {
    id: "p8",
    filename: "sheets-linen.jpg",
    prompt: "Professional product photography, Belgian linen bed sheet set, neatly folded stack, crisp natural white linen, pure white background, soft texture, centered, soft studio lighting, minimal, no text, photorealistic",
  },
  {
    id: "p9",
    filename: "mirror-wall.jpg",
    prompt: "Professional product photography, single minimal circular wall mirror, thin brass gold frame, pure white background, centered, soft studio lighting, Scandinavian design, HAY catalog style, no text, photorealistic",
  },
  {
    id: "p10",
    filename: "towel-cotton.jpg",
    prompt: "Professional product photography, two cotton bath towels, neatly folded and stacked, pure white cotton, clean texture, white background, centered, soft studio lighting, minimal spa style, no text, photorealistic",
  },
  {
    id: "p11",
    filename: "cushion-silk.jpg",
    prompt: "Professional product photography, single silk cushion cover pillow, soft dusty blue silk fabric, sheen visible, white background, centered, soft diffused studio lighting, luxury minimal style, no text, photorealistic",
  },
  {
    id: "p12",
    filename: "planter-terracotta.jpg",
    prompt: "Professional product photography, single terracotta planter pot, medium size, raw unglazed clay texture, pure white background, centered, soft natural studio lighting, minimal Scandinavian style, empty pot no plant, no text, photorealistic",
  },
];

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        fs.unlinkSync(filepath);
        downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      fs.unlinkSync(filepath);
      reject(err);
    });
  });
}

async function generateAll() {
  for (const product of products) {
    const encodedPrompt = encodeURIComponent(product.prompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=1000&nologo=true&seed=${Math.floor(Math.random() * 9999)}`;
    const filepath = path.join(OUTPUT_DIR, product.filename);

    process.stdout.write(`生成中: ${product.filename} ... `);
    try {
      await downloadImage(url, filepath);
      const size = Math.round(fs.statSync(filepath).size / 1024);
      console.log(`✅ ${size}KB`);
    } catch (err) {
      console.log(`❌ エラー: ${err.message}`);
    }
    // レート制限対策で少し待機
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log("\n🎉 全商品画像の生成完了！");
  console.log("public/products/ フォルダを確認してください。");
}

generateAll();
