// 冒烟测试运行器：起一个假的 OpenAI 服务，打包 smoke.ts 并执行
import { createServer } from "node:http";
import { build } from "esbuild";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const port = Number(process.env.SMOKE_AI_PORT || 18777);

const REPORT = `## 本周完成
- 完成季度材料归档核对，已归档。
- 补充项目台账近两年变更信息。

## 进行中
- 跟进外部单位回函，待确认盖章事宜。

## 问题与风险
- 跨部门职责边界待明确。

## 下周计划
- 整理下周待办清单。`;

let callCount = 0;

const server = createServer((req, res) => {
  if (!req.url.endsWith("/chat/completions")) {
    res.writeHead(404).end("not found");
    return;
  }
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    callCount += 1;
    const auth = req.headers.authorization || "";
    const payload = JSON.parse(body || "{}");
    const userContent = payload?.messages?.find((m) => m.role === "user")?.content || "";
    console.log(`[fake-ai] call #${callCount} model=${payload.model} auth=${auth} promptChars=${userContent.length}`);
    if (!auth.startsWith("Bearer ")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "missing api key" } }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: REPORT } }] }));
  });
});

await new Promise((r) => server.listen(port, "127.0.0.1", r));
console.log(`[fake-ai] listening on ${port}`);

await build({
  entryPoints: [resolve(here, "smoke.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: resolve(here, ".smoke.cjs"),
  logLevel: "error",
});

const child = spawn(process.execPath, [resolve(here, ".smoke.cjs")], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  server.close();
  process.exit(code ?? 0);
});
