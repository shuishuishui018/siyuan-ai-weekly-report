import zhCN from "../i18n/zh_CN.json";
import enUS from "../i18n/en_US.json";

type Dict = Record<string, string>;

const ZH = zhCN as Dict;
const EN = enUS as Dict;

function detectDict(): Dict {
  let lang = "";
  try {
    lang = String((window as any)?.siyuan?.config?.lang ?? "");
  } catch {
    lang = "";
  }
  if (!lang) {
    lang = typeof navigator !== "undefined" ? navigator.language : "";
  }
  const normalized = lang.replace("-", "_").toLowerCase();
  if (normalized.startsWith("zh")) {
    return ZH;
  }
  return normalized.startsWith("en") ? EN : ZH;
}

const DICT = detectDict();

export function t(key: string, vars?: Record<string, string | number>): string {
  let text = DICT[key] ?? ZH[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

export function isZh(): boolean {
  return DICT === ZH;
}
