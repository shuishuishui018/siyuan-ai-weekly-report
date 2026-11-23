// 替换插件元数据中的仓库归属：node scripts/set-owner.mjs <github-owner>
// 修改 plugin.json 的 url，之后重新执行 npm run build 重新生成 package.zip
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const owner = (process.argv[2] || "").trim();

if (!owner) {
  console.error("用法：node scripts/set-owner.mjs <github-owner>");
  process.exit(1);
}

const manifestPath = resolve(root, "plugin.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.url = `https://github.com/${owner}/${manifest.name}`;
manifest.author = manifest.author === "AI Weekly Report Contributors" ? owner : manifest.author;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`plugin.json 已更新：${manifest.url}`);
console.log("接下来请执行 npm run build 重新生成 package.zip");
