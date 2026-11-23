import type { PluginSettings } from "./types";
import { exportDocMarkdown, sql } from "./api";
import { toSiyuanTime, type DateRange } from "./week";

export interface DocItem {
  id: string;
  hpath: string;
  updated: string;
  markdown: string;
}

export interface CollectResult {
  docs: DocItem[];
  totalChars: number;
  truncatedDocs: number;
  skippedSensitive: number;
  outOfScope: number;
  scanned: number;
}

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

/** 去掉导出时的 YAML frontmatter，只保留正文 */
function stripFrontmatter(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---")) {
    return normalized;
  }
  const end = normalized.indexOf("\n---", 3);
  if (end === -1) {
    return normalized;
  }
  return normalized.slice(end + 4).replace(/^\n+/, "");
}

function matchesAny(hpath: string, keywords: string[]): boolean {
  return keywords.some((k) => k.trim() && hpath.toLowerCase().includes(k.trim().toLowerCase()));
}

/** 把素材切成单篇文本 */
export function formatDoc(item: DocItem): string {
  const stamp = item.updated?.length >= 12 ? item.updated : "";
  const when = stamp
    ? `更新于 ${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`
    : "";
  return `### ${item.hpath}${when ? `（${when}）` : ""}\n${item.markdown}`;
}

/** 提取素材中未完成的任务项，形如 "- [ ] 跟进外部单位回函@11-25" */
export function extractOpenTasks(docs: DocItem[]): string[] {
  const tasks: string[] = [];
  const seen = new Set<string>();
  for (const doc of docs) {
    const re = /^\s*[-*]\s*\[[ ]\]\s*(.+)$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(doc.markdown)) !== null) {
      const text = m[1].replace(/\s+/g, " ").trim();
      if (text && !seen.has(text)) {
        seen.add(text);
        tasks.push(text);
      }
    }
  }
  return tasks.slice(0, 50);
}

export async function collectDocs(settings: PluginSettings, range: DateRange): Promise<CollectResult> {
  const start = toSiyuanTime(range.start);
  const end = toSiyuanTime(range.end, true);
  const conds = [`type = 'd'`, `updated >= '${start}'`, `updated <= '${end}'`];
  if (settings.source.notebooks.length > 0) {
    conds.push(`box IN (${settings.source.notebooks.map((id) => `'${esc(id)}'`).join(",")})`);
  }
  const stmt =
    `SELECT id, hpath, updated FROM blocks WHERE ${conds.join(" AND ")} ` +
    `ORDER BY updated DESC LIMIT 500`;

  const rows = await sql(stmt);
  const result: CollectResult = {
    docs: [],
    totalChars: 0,
    truncatedDocs: 0,
    skippedSensitive: 0,
    outOfScope: 0,
    scanned: rows.length,
  };

  const includePaths = settings.source.includePaths.filter((p) => p.trim());
  const excludes = settings.source.excludeKeywords.filter((k) => k.trim());
  const maxDocChars = Math.max(500, settings.source.maxDocChars || 6000);
  const maxTotalChars = Math.max(2000, settings.source.maxTotalChars || 60000);

  for (const row of rows) {
    const hpath = row.hpath || "";
    if (matchesAny(hpath, excludes)) {
      result.skippedSensitive += 1;
      continue;
    }
    if (includePaths.length > 0 && !matchesAny(hpath, includePaths)) {
      result.outOfScope += 1;
      continue;
    }

    let markdown: string;
    try {
      const doc = await exportDocMarkdown(row.id);
      markdown = stripFrontmatter(doc.content).trim();
    } catch {
      continue;
    }
    if (!markdown) {
      continue;
    }
    if (markdown.length > maxDocChars) {
      markdown = `${markdown.slice(0, maxDocChars)}\n…（本篇已截断）`;
      result.truncatedDocs += 1;
    }
    if (result.totalChars + markdown.length > maxTotalChars) {
      break;
    }
    result.docs.push({ id: row.id, hpath, updated: row.updated || "", markdown });
    result.totalChars += markdown.length;
  }

  // 素材按时间正序送入模型，便于模型理解推进顺序
  result.docs.reverse();
  return result;
}
