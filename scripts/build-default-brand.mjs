import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourcePath = path.join(root, "third-party", "lucide-workflow.svg");
const source = await fs.readFile(sourcePath, "utf8");

const destinations = [
  path.join(root, "public", "branding"),
  path.join(root, "hostinger-backend", "brand-defaults"),
];

const variants = {
  colour: "#2563EB",
  black: "#111827",
  white: "#FFFFFF",
};

for (const directory of destinations) {
  await fs.mkdir(directory, { recursive: true });
  for (const [variant, colour] of Object.entries(variants)) {
    const svg = source
      .replace('width="24"', 'width="512"')
      .replace('height="24"', 'height="512"')
      .replace('stroke="currentColor"', `stroke="${colour}"`)
      .replace('stroke-width="2"', 'stroke-width="1.8"');
    await sharp(Buffer.from(svg))
      .resize(512, 512, { fit: "contain" })
      .png({ compressionLevel: 9 })
      .toFile(path.join(directory, `logo-${variant}.png`));
  }
}

const iconSvg = source
  .replace('width="24"', 'width="512"')
  .replace('height="24"', 'height="512"')
  .replace('stroke="currentColor"', 'stroke="#FFFFFF"')
  .replace('stroke-width="2"', 'stroke-width="1.8"');

for (const size of [192, 512]) {
  const padding = Math.round(size * 0.2);
  const mark = await sharp(Buffer.from(iconSvg))
    .resize(size - padding * 2, size - padding * 2, { fit: "contain" })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: "#2563EB",
    },
  })
    .composite([{ input: mark, top: padding, left: padding }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "public", `icon-${size}.png`));
}

await fs.copyFile(
  path.join(root, "third-party", "LUCIDE-LICENSE.txt"),
  path.join(root, "public", "branding", "LUCIDE-LICENSE.txt"),
);
