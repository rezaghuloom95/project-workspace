import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";

const projectRoot = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(projectRoot, "hostinger-package");

await rm(outputDirectory, { recursive: true, force: true });

await build({
  configFile: resolve(projectRoot, "vite.hostinger.config.ts"),
});

await cp(
  resolve(projectRoot, "hostinger-backend"),
  outputDirectory,
  { recursive: true },
);
await cp(
  resolve(projectRoot, "HOSTINGER-UPLOAD.md"),
  resolve(outputDirectory, "HOSTINGER-UPLOAD.md"),
);
await cp(
  resolve(projectRoot, "THIRD-PARTY-NOTICES.md"),
  resolve(outputDirectory, "THIRD-PARTY-NOTICES.md"),
);
await mkdir(resolve(outputDirectory, "storage"), { recursive: true });
await writeFile(
  resolve(outputDirectory, "storage", "data.json"),
  "{}\n",
  { flag: "wx" },
).catch((error) => {
  if (error?.code !== "EEXIST") throw error;
});

console.log(`Hostinger package ready: ${outputDirectory}`);
