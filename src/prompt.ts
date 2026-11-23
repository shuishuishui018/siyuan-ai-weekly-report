import type { ChatMessage } from "./api";
import type { PluginSettings } from "./types";
import { formatDoc, type DocItem } from "./collector";
import type { DateRange } from "./week";

export function buildMaterials(docs: DocItem[], tasks: string[]): string {
  const parts = docs.map(formatDoc);
  if (tasks.length > 0) {
    parts.push(`### 未完成任务清单（checkbox）\n${tasks.map((t) => `- [ ] ${t}`).join("\n")}`);
  }
  return parts.join("\n\n");
}

export function buildMessages(
  settings: PluginSettings,
  range: DateRange,
  docs: DocItem[],
  tasks: string[],
): ChatMessage[] {
  const materials = buildMaterials(docs, tasks);
  const template = settings.prompt.template || "";
  const user = template
    .replace(/\{\{range\}\}/g, range.label)
    .replace(/\{\{docCount\}\}/g, String(docs.length))
    .replace(/\{\{materials\}\}/g, materials)
    .replace(/\{\{tasks\}\}/g, tasks.length ? tasks.map((t) => `- [ ] ${t}`).join("\n") : "- 无");

  return [
    { role: "system", content: settings.prompt.system },
    { role: "user", content: user },
  ];
}

/** 去掉模型偶尔裹上的代码块围栏与开场白 */
export function cleanModelOutput(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").trim();
  const fenced = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(text);
  if (fenced) {
    text = fenced[1].trim();
  }
  text = text.replace(/^```(?:markdown|md)?\s*\n/i, "").replace(/\n```\s*$/i, "");
  return text.trim();
}
