import { chat, createDoc, docExistsByPath, listNotebooks } from "./api";
import { collectDocs, extractOpenTasks } from "./collector";
import { buildMessages, cleanModelOutput } from "./prompt";
import { formatTitle, resolveRange, toSiyuanDate } from "./week";
import type { PluginSettings, RepeatStrategy } from "./types";

export interface GenerateResult {
  docId: string;
  title: string;
  docCount: number;
  notebookName: string;
  charCount: number;
  /** true 表示本周周报已存在且策略为 skip，未调用 AI、未建文档 */
  skipped: boolean;
  /** 目标文档路径（skip 时为命中的已有文档路径） */
  path: string;
}

/** 同名文档最多顺延到这个序号，避免死循环 */
const SAME_TITLE_LIMIT = 50;

function joinDocPath(folder: string, title: string): string {
  const clean = (folder || "/AI周报").trim().replace(/^\/+|\/+$/g, "");
  return clean ? `/${clean}/${title}` : `/${title}`;
}

/** skip 命中已有文档时返回 skipped，suffix 时返回第一个可用的「标题 N」路径 */
export async function resolveTargetPath(
  basePath: string,
  strategy: RepeatStrategy,
): Promise<{ path: string; skipped: boolean }> {
  if (!(await docExistsByPath(basePath))) {
    return { path: basePath, skipped: false };
  }
  if (strategy === "skip") {
    return { path: basePath, skipped: true };
  }
  for (let i = 2; i <= SAME_TITLE_LIMIT; i += 1) {
    const candidate = `${basePath} ${i}`;
    if (!(await docExistsByPath(candidate))) {
      return { path: candidate, skipped: false };
    }
  }
  throw new Error(`同名周报已超过 ${SAME_TITLE_LIMIT} 份（${basePath}），请先清理旧文档。`);
}

export async function generateWeeklyReport(
  settings: PluginSettings,
  onProgress: (text: string) => void,
): Promise<GenerateResult> {
  const range = resolveRange(
    settings.range.mode,
    settings.range.lastNDays,
    settings.range.customStart,
    settings.range.customEnd,
  );
  const basePath = joinDocPath(settings.output.folder, formatTitle(settings.output.titleTemplate, range));
  // 重复判定必须在调用 AI 之前完成：跳过时既不消耗模型额度也不建文档
  const target = await resolveTargetPath(basePath, settings.output.existing);
  const title = target.path.slice(target.path.lastIndexOf("/") + 1);
  if (target.skipped) {
    return {
      docId: "",
      title,
      docCount: 0,
      notebookName: "",
      charCount: 0,
      skipped: true,
      path: target.path,
    };
  }

  onProgress(`正在收集 ${range.label} 的素材…`);
  const collected = await collectDocs(settings, range);
  if (collected.docs.length === 0) {
    throw new Error(
      `在 ${range.label} 内没有找到可用素材。请检查「素材范围」中的笔记本与路径（当前包含路径：${
        settings.source.includePaths.join("、") || "未限制"
      }），或调整时间范围。`,
    );
  }

  const tasks = extractOpenTasks(collected.docs);
  onProgress(`已收集 ${collected.docs.length} 篇素材，正在调用 AI 生成周报…`);
  const content = await chat(settings.ai, buildMessages(settings, range, collected.docs, tasks));
  const body = cleanModelOutput(content);
  if (!body) {
    throw new Error("AI 返回内容为空，请稍后重试或更换模型。");
  }

  const notebook = settings.output.notebook || (await listNotebooks())[0]?.id;
  if (!notebook) {
    throw new Error("没有可用的笔记本，无法保存周报。");
  }

  let markdown = body;
  if (settings.output.writeProvenance) {
    const now = new Date();
    const stamp = `${toSiyuanDate(now)} ${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;
    markdown += `\n\n---\n\n> 本报告由 AI 汇总 ${collected.docs.length} 篇素材生成于 ${stamp}，周期 ${range.label}。\n`;
  }

  onProgress("正在写入周报文档…");
  const docId = await createDoc(notebook, target.path, markdown);
  if (!docId) {
    throw new Error("周报文档创建失败，请查看思源内核日志。");
  }
  const notebooks = await listNotebooks();
  const notebookName = notebooks.find((n) => n.id === notebook)?.name ?? "";

  return {
    docId,
    title,
    docCount: collected.docs.length,
    notebookName,
    charCount: body.length,
    skipped: false,
    path: target.path,
  };
}
