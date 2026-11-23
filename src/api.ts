import type { AISettings } from "./types";

export async function kernelPost<T = unknown>(api: string, payload: unknown = {}): Promise<T> {
  const res = await fetch("/" + api, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
  if (!res.ok) {
    throw new Error(`内核接口 ${api} 请求失败：HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(json.msg || `内核接口 ${api} 返回错误码 ${json.code}`);
  }
  return json.data as T;
}

export interface Notebook {
  id: string;
  name: string;
  closed: boolean;
}

export async function listNotebooks(): Promise<Notebook[]> {
  const data = await kernelPost<{ notebooks: Notebook[] }>("api/notebook/lsNotebooks");
  return (data?.notebooks ?? []).filter((n) => !n.closed);
}

export async function sql(stmt: string): Promise<Record<string, string>[]> {
  const data = await kernelPost<Record<string, string>[]>("api/query/sql", { stmt });
  return Array.isArray(data) ? data : [];
}

function escSql(value: string): string {
  return value.replace(/'/g, "''");
}

/** 目标路径（hpath，带前导 /）下是否已有文档，用于判断同一周是否重复生成 */
export async function docExistsByPath(path: string): Promise<boolean> {
  const rows = await sql(
    `SELECT id FROM blocks WHERE type = 'd' AND hpath = '${escSql(path)}' LIMIT 1`,
  );
  return rows.length > 0;
}

export async function exportDocMarkdown(id: string): Promise<{ hPath: string; content: string }> {
  const data = await kernelPost<{ hPath: string; content: string }>("api/export/exportMdContent", { id });
  return { hPath: data?.hPath ?? "", content: data?.content ?? "" };
}

export async function createDoc(notebook: string, path: string, markdown: string): Promise<string> {
  const id = await kernelPost<string>("api/filetree/createDocWithMd", { notebook, path, markdown });
  return String(id ?? "");
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function endpointOf(baseUrl: string): string {
  const base = (baseUrl || "").trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error("请先在插件设置中填写 API 地址（apiBaseUrl）");
  }
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

function buildPayload(cfg: AISettings, messages: ChatMessage[]) {
  return {
    model: cfg.model,
    messages,
    temperature: Number.isFinite(cfg.temperature) ? cfg.temperature : 0.3,
    max_tokens: Math.max(256, Math.floor(cfg.maxTokens || 2000)),
    stream: false,
  };
}

function extractContent(raw: string): string {
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`AI 接口返回的不是合法 JSON：${raw.slice(0, 300)}`);
  }
  const choice = json?.choices?.[0];
  const content = choice?.message?.content ?? choice?.text;
  if (typeof content !== "string" || !content.trim()) {
    const msg = json?.error?.message || json?.message || raw.slice(0, 300);
    throw new Error(`AI 未返回有效内容：${msg}`);
  }
  return content.trim();
}

function describeFailure(status: number, body: string): string {
  const brief = body.replace(/\s+/g, " ").slice(0, 200);
  if (status === 401 || status === 403) {
    return `AI 接口鉴权失败（HTTP ${status}），请检查 API Key 是否有效。${brief}`;
  }
  if (status === 404) {
    return `AI 接口地址不存在（HTTP 404），请检查 API 地址，通常需要以 /v1 结尾。${brief}`;
  }
  if (status === 429) {
    return `AI 接口限流或额度不足（HTTP 429）。${brief}`;
  }
  return `AI 接口返回 HTTP ${status}：${brief}`;
}

/** 通过内核转发请求，避免渲染进程的跨域限制 */
async function chatViaKernel(cfg: AISettings, messages: ChatMessage[]): Promise<string> {
  const headers: Record<string, string>[] = [{ "Content-Type": "application/json" }];
  if (cfg.apiKey) {
    headers.push({ Authorization: `Bearer ${cfg.apiKey}` });
  }
  const data = await kernelPost<{ status: number; body: string; contentType: string }>(
    "api/network/forwardProxy",
    {
      url: endpointOf(cfg.apiBaseUrl),
      method: "POST",
      timeout: Math.max(5000, Math.floor(cfg.requestTimeout || 180000)),
      contentType: "application/json",
      headers,
      payload: buildPayload(cfg, messages),
    },
  );
  const status = Number(data?.status ?? 0);
  const body = typeof data?.body === "string" ? data.body : "";
  if (status < 200 || status >= 300) {
    throw new Error(describeFailure(status, body));
  }
  return extractContent(body);
}

/** 直连兜底：适合本地模型（Ollama / LM Studio）且内核代理不可用时 */
async function chatDirect(cfg: AISettings, messages: ChatMessage[]): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, cfg.requestTimeout || 180000));
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.apiKey) {
      headers.Authorization = `Bearer ${cfg.apiKey}`;
    }
    const res = await fetch(endpointOf(cfg.apiBaseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify(buildPayload(cfg, messages)),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(describeFailure(res.status, text));
    }
    return extractContent(text);
  } finally {
    clearTimeout(timer);
  }
}

export async function chat(cfg: AISettings, messages: ChatMessage[]): Promise<string> {
  if (!cfg.model) {
    throw new Error("请先在插件设置中填写模型名称");
  }
  try {
    return await chatViaKernel(cfg, messages);
  } catch (proxyError) {
    try {
      return await chatDirect(cfg, messages);
    } catch (directError) {
      const p = proxyError instanceof Error ? proxyError.message : String(proxyError);
      const d = directError instanceof Error ? directError.message : String(directError);
      throw new Error(d === p ? d : `内核转发失败：${p}\n直连也失败：${d}`);
    }
  }
}
