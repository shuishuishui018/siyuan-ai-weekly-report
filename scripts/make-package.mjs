// 组装思源市场要求的 package.zip：i18n / assets / index.js / index.css / plugin.json / README / icon / preview
import JSZip from "jszip";
import { readFile, writeFile, mkdir, rm, readdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(root, "package");

async function main() {
  const entry = join(root, "dist", "index.js");
  if (!existsSync(entry)) {
    throw new Error("dist/index.js 不存在，请先执行 vite build");
  }

  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });

  const files = ["plugin.json", "index.css", "icon.png", "preview.png", "README.md", "README_zh_CN.md", "LICENSE"];

  for (const file of files) {
    const src = join(root, file);
    if (existsSync(src)) {
      await copyFile(src, join(stage, file));
    }
  }

  await copyFile(entry, join(stage, "index.js"));

  const i18nDir = join(root, "i18n");
  if (existsSync(i18nDir)) {
    await mkdir(join(stage, "i18n"), { recursive: true });
    for (const name of await readdir(i18nDir)) {
      if (name.endsWith(".json")) {
        await copyFile(join(i18nDir, name), join(stage, "i18n", name));
      }
    }
  }

  // 设置面板里的打赏二维码：思源把 data/plugins 挂载在 /plugins/ 下
  const assetDir = join(root, "assets");
  if (existsSync(assetDir)) {
    await mkdir(join(stage, "assets"), { recursive: true });
    for (const name of await readdir(assetDir)) {
      await copyFile(join(assetDir, name), join(stage, "assets", name));
    }
  }

  const zip = new JSZip();
  const entries = await collect(stage);
  for (const relative of entries) {
    zip.file(relative, await readFile(join(stage, relative)));
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await writeFile(join(root, "package.zip"), buffer);

  const manifest = JSON.parse(await readFile(join(root, "plugin.json"), "utf8"));
  console.log(`package.zip 已生成（版本 ${manifest.version}，${entries.length} 个文件，${buffer.length} 字节）`);
  for (const relative of entries) {
    console.log("  -", relative);
  }
}

async function collect(base, prefix = "") {
  const result = [];
  for (const item of await readdir(join(base, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) {
      result.push(...(await collect(base, relative)));
    } else {
      result.push(relative);
    }
  }
  return result;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
