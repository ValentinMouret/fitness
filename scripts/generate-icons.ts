import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ICONS_DIR = join(import.meta.dirname, "../public/icons");

function generateSvg(size: number): string {
  const fontSize = Math.round(size * 0.5);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#ff6b6b" rx="${Math.round(size * 0.15)}"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="700" fill="white">F</text>
</svg>`;
}

async function convertSvgToPng(svg: string, outputPath: string) {
  const sharp = await import("sharp").catch(() => null);
  if (!sharp) {
    console.log(
      "sharp not installed. Install with: bun add -D sharp\nSaving SVG instead.",
    );
    writeFileSync(outputPath.replace(".png", ".svg"), svg);
    return;
  }
  const buffer = await sharp.default(Buffer.from(svg)).png().toBuffer();
  writeFileSync(outputPath, buffer);
  console.log(`Generated: ${outputPath}`);
}

async function main() {
  const sizes = [
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
    { name: "apple-touch-icon.png", size: 180 },
  ];

  for (const { name, size } of sizes) {
    const svg = generateSvg(size);
    await convertSvgToPng(svg, join(ICONS_DIR, name));
  }
}

main();
