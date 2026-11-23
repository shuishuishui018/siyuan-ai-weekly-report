/**
 * 冒烟测试：不启动思源界面，直接跑通「采集 → 提示词 → 调 AI → 建文档」链路。
 * 用法：node scripts/run-smoke.mjs
 */
import { generateWeeklyReport } from "../src/report";
import { mergeSettings } from "../src/types";

const KERNEL = "http://127.0.0.1:6806";
const NOTEBOOK = process.env.SMOKE_NOTEBOOK || "";
const AI_PORT = Number(process.env.SMOKE_AI_PORT || 18777);

const originalFetch = globalThis.fetch;

async function main() {
  if (!NOTEBOOK) {
    throw new Error("请通过 SMOKE_NOTEBOOK 指定目标笔记本 id");
  }

  // 把插件的相对内核请求转发到真实内核
  globalThis.fetch = ((input: any, init?: any) => {
    if (typeof input === "string" && input.startsWith("/")) {
      return originalFetch(KERNEL + input, init);
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const settings = mergeSettings({
    ai: {
      apiBaseUrl: `http://127.0.0.1:${AI_PORT}/v1`,
      apiKey: "smoke-key",
      model: "fake-model",
      temperature: 0.2,
      maxTokens: 800,
      requestTimeout: 30000,
    },
    source: {
      notebooks: [NOTEBOOK],
      includePaths: ["/工作日志"],
      excludeKeywords: ["账号密码"],
      maxDocChars: 3000,
      maxTotalChars: 20000,
    },
    range: { mode: "lastNDays", lastNDays: 10 },
    output: {
      notebook: NOTEBOOK,
      folder: "/SMOKE-AI周报",
      titleTemplate: "SMOKE {{YYYY}}-W{{WW}}",
      openAfterCreate: false,
      writeProvenance: true,
    },
  });

  const result = await generateWeeklyReport(settings, (text) => console.log("[progress]", text));
  console.log("[result]", JSON.stringify(result, null, 2));

  const res = await originalFetch(`${KERNEL}/api/export/exportMdContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: result.docId }),
  }).then((r) => r.json());
  const created = String(res?.data?.content || "");
  console.log("[doc:hpath]", res?.data?.hPath);

  const checks: Array<[string, boolean]> = [
    ["周报文档已创建", Boolean(result.docId) && Boolean(res?.data?.hPath)],
    ["文件名符合标题模板", String(res?.data?.hPath || "").includes("SMOKE 2026-W")],
    ["只收集路径内的素材", result.docCount > 0],
    ["包含结构化小节", created.includes("## 本周完成") && created.includes("## 问题与风险")],
    ["包含素材来源标注", created.includes("本报告由 AI 汇总")],
  ];
  let failed = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) failed += 1;
  }
  console.log("[doc:content]\n" + created.slice(0, 800));

  // 清理测试文档
  const del = await originalFetch(`${KERNEL}/api/filetree/removeDocByID`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: result.docId }),
  }).then((r) => r.json());
  console.log("[cleanup]", del?.code === 0 ? "ok" : JSON.stringify(del));
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[smoke:failed]", error);
  process.exit(1);
});
