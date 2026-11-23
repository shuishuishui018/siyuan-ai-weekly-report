import { Dialog, getFrontend, showMessage } from "siyuan";
import { listNotebooks, type Notebook } from "./api";
import { t } from "./i18n";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_TEMPLATE,
  type PluginSettings,
  type RangeMode,
} from "./types";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function field(label: string, desc: string, control: string): string {
  return `<div class="air-field">
  <div class="air-field__label">${esc(label)}</div>
  ${desc ? `<div class="air-field__desc">${esc(desc)}</div>` : ""}
  <div class="air-field__control">${control}</div>
</div>`;
}

function section(title: string, desc: string, body: string): string {
  return `<section class="air-section">
  <h3 class="air-section__title">${esc(title)}</h3>
  ${desc ? `<p class="air-section__desc">${esc(desc)}</p>` : ""}
  ${body}
</section>`;
}

const MODES: RangeMode[] = ["thisWeek", "lastWeek", "lastNDays", "custom"];

function modeLabel(mode: RangeMode): string {
  switch (mode) {
    case "thisWeek":
      return t("modeThisWeek");
    case "lastWeek":
      return t("modeLastWeek");
    case "lastNDays":
      return t("modeLastNDays");
    default:
      return t("modeCustom");
  }
}

function buildContent(settings: PluginSettings, notebooks: Notebook[]): string {
  const nbChecks =
    notebooks.length === 0
      ? `<div class="air-hint">${esc(t("labNotebooksDesc"))}</div>`
      : notebooks
          .map(
            (nb) => `<label class="air-check"><input type="checkbox" data-role="nb" value="${esc(
              nb.id,
            )}" ${settings.source.notebooks.includes(nb.id) ? "checked" : ""}><span>${esc(
              nb.name,
            )}</span></label>`,
          )
          .join("");

  const outOptions = [
    `<option value="" ${settings.output.notebook ? "" : "selected"}>— ${esc(t("labOutNotebookDesc"))} —</option>`,
    ...notebooks.map(
      (nb) =>
        `<option value="${esc(nb.id)}" ${settings.output.notebook === nb.id ? "selected" : ""}>${esc(
          nb.name,
        )}</option>`,
    ),
  ].join("");

  const modeOptions = MODES.map(
    (m) => `<option value="${m}" ${settings.range.mode === m ? "selected" : ""}>${esc(modeLabel(m))}</option>`,
  ).join("");

  return `<div class="b3-dialog__content air-settings">
  <div class="air-scroll">
    ${section(
      t("sectionAi"),
      t("sectionAiDesc"),
      field(
        t("labBaseUrl"),
        t("labBaseUrlDesc"),
        `<input class="b3-text-field fn__block" id="air-base-url" value="${esc(settings.ai.apiBaseUrl)}" placeholder="https://api.deepseek.com/v1">`,
      ) +
        field(
          t("labApiKey"),
          t("labApiKeyDesc"),
          `<input class="b3-text-field fn__block" type="password" id="air-api-key" value="${esc(
            settings.ai.apiKey,
          )}" autocomplete="off">`,
        ) +
        field(
          t("labModel"),
          t("labModelDesc"),
          `<input class="b3-text-field fn__block" id="air-model" value="${esc(settings.ai.model)}" placeholder="deepseek-chat">`,
        ) +
        `<div class="air-grid2">
          ${field(
            t("labTemperature"),
            t("labTemperatureDesc"),
            `<input class="b3-text-field fn__block" type="number" step="0.1" min="0" max="2" id="air-temperature" value="${esc(
              settings.ai.temperature,
            )}">`,
          )}
          ${field(
            t("labMaxTokens"),
            t("labMaxTokensDesc"),
            `<input class="b3-text-field fn__block" type="number" step="100" min="256" id="air-max-tokens" value="${esc(
              settings.ai.maxTokens,
            )}">`,
          )}
        </div>`,
    )}
    ${section(
      t("sectionSource"),
      t("sectionSourceDesc"),
      field(t("labNotebooks"), t("labNotebooksDesc"), `<div class="air-checks">${nbChecks}</div>`) +
        field(
          t("labIncludePaths"),
          t("labIncludePathsDesc"),
          `<textarea class="b3-text-field fn__block" rows="3" id="air-include-paths">${esc(
            settings.source.includePaths.join("\n"),
          )}</textarea>`,
        ) +
        field(
          t("labExclude"),
          t("labExcludeDesc"),
          `<textarea class="b3-text-field fn__block" rows="3" id="air-exclude">${esc(
            settings.source.excludeKeywords.join("\n"),
          )}</textarea>`,
        ) +
        `<div class="air-grid2">
          ${field(
            t("labMaxDocChars"),
            t("labMaxDocCharsDesc"),
            `<input class="b3-text-field fn__block" type="number" step="500" min="500" id="air-max-doc" value="${esc(
              settings.source.maxDocChars,
            )}">`,
          )}
          ${field(
            t("labMaxTotalChars"),
            t("labMaxTotalCharsDesc"),
            `<input class="b3-text-field fn__block" type="number" step="1000" min="2000" id="air-max-total" value="${esc(
              settings.source.maxTotalChars,
            )}">`,
          )}
        </div>`,
    )}
    ${section(
      t("sectionRange"),
      t("sectionRangeDesc"),
      field(t("labMode"), "", `<select class="b3-select fn__block" id="air-mode">${modeOptions}</select>`) +
        `<div class="air-grid2">
          ${field(
            t("labLastNDays"),
            "",
            `<input class="b3-text-field fn__block" type="number" min="1" max="365" id="air-last-n" value="${esc(
              settings.range.lastNDays,
            )}">`,
          )}
          <div></div>
        </div>
        <div class="air-grid2">
          ${field(
            t("labCustomStart"),
            "",
            `<input class="b3-text-field fn__block" type="date" id="air-custom-start" value="${esc(
              settings.range.customStart,
            )}">`,
          )}
          ${field(
            t("labCustomEnd"),
            "",
            `<input class="b3-text-field fn__block" type="date" id="air-custom-end" value="${esc(
              settings.range.customEnd,
            )}">`,
          )}
        </div>`,
    )}
    ${section(
      t("sectionOutput"),
      t("sectionOutputDesc"),
      field(t("labOutNotebook"), "", `<select class="b3-select fn__block" id="air-out-notebook">${outOptions}</select>`) +
        field(
          t("labFolder"),
          t("labFolderDesc"),
          `<input class="b3-text-field fn__block" id="air-folder" value="${esc(settings.output.folder)}">`,
        ) +
        field(
          t("labTitle"),
          t("labTitleDesc"),
          `<input class="b3-text-field fn__block" id="air-title" value="${esc(
            settings.output.titleTemplate,
          )}">`,
        ) +
        `<div class="air-checks">
          <label class="air-check"><input type="checkbox" id="air-open" ${
            settings.output.openAfterCreate ? "checked" : ""
          }><span>${esc(t("labOpen"))}</span></label>
          <label class="air-check"><input type="checkbox" id="air-provenance" ${
            settings.output.writeProvenance ? "checked" : ""
          }><span>${esc(t("labProvenance"))}</span></label>
        </div>`,
    )}
    ${section(
      t("sectionPrompt"),
      t("sectionPromptDesc"),
      field(
        t("labSystem"),
        "",
        `<textarea class="b3-text-field fn__block air-mono" rows="8" id="air-system">${esc(
          settings.prompt.system,
        )}</textarea>`,
      ) +
        field(
          t("labTemplate"),
          "",
          `<textarea class="b3-text-field fn__block air-mono" rows="6" id="air-template">${esc(
            settings.prompt.template,
          )}</textarea>`,
        ) +
        `<button class="b3-button b3-button--outline air-reset-prompt" data-role="reset-prompt">${
          isZhLike() ? "恢复默认提示词" : "Reset prompts"
        }</button>`,
    )}
  </div>
  <div class="air-footer">
    <button class="b3-button b3-button--cancel" data-role="cancel">${esc(t("btnCancel"))}</button>
    <button class="b3-button b3-button--text" data-role="save">${esc(t("btnSave"))}</button>
  </div>
</div>`;
}

function isZhLike(): boolean {
  try {
    return String((window as any)?.siyuan?.config?.lang ?? "").toLowerCase().startsWith("zh");
  } catch {
    return false;
  }
}

function linesOf(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function openSettingsDialog(
  current: PluginSettings,
  onSave: (next: PluginSettings) => Promise<void>,
): Promise<void> {
  let notebooks: Notebook[] = [];
  try {
    notebooks = await listNotebooks();
  } catch {
    notebooks = [];
  }

  // 手机屏宽通常 360~430px，写死 760px 会横向溢出、底部按钮点不到
  const frontend = getFrontend();
  const isMobile = frontend === "mobile" || frontend === "browser-mobile";

  const dialog = new Dialog({
    title: t("settingsTitle"),
    content: buildContent(current, notebooks),
    width: isMobile ? "100%" : "760px",
    height: isMobile ? "100%" : "82vh",
    destroyCallback: () => {},
  });

  const root = dialog.element;
  const pick = <T extends HTMLElement>(selector: string): T | null =>
    root.querySelector(selector) as T | null;
  const value = (selector: string): string => pick<HTMLInputElement>(selector)?.value?.trim() ?? "";
  const number = (selector: string, fallback: number): number => {
    const parsed = Number(value(selector));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  pick<HTMLElement>('[data-role="reset-prompt"]')?.addEventListener("click", () => {
    const system = pick<HTMLTextAreaElement>("#air-system");
    const template = pick<HTMLTextAreaElement>("#air-template");
    if (system) {
      system.value = DEFAULT_SYSTEM_PROMPT;
    }
    if (template) {
      template.value = DEFAULT_USER_TEMPLATE;
    }
  });

  pick<HTMLElement>('[data-role="cancel"]')?.addEventListener("click", () => dialog.destroy());

  pick<HTMLElement>('[data-role="save"]')?.addEventListener("click", async () => {
    const selectedNotebooks = Array.from(
      root.querySelectorAll<HTMLInputElement>('input[data-role="nb"]:checked'),
    ).map((el) => el.value);

    const next: PluginSettings = {
      ai: {
        apiBaseUrl: value("#air-base-url"),
        apiKey: value("#air-api-key"),
        model: value("#air-model"),
        temperature: Math.min(Math.max(number("#air-temperature", 0.3), 0), 2),
        maxTokens: Math.max(256, number("#air-max-tokens", 2000)),
        requestTimeout: current.ai.requestTimeout || 180000,
      },
      source: {
        notebooks: selectedNotebooks,
        includePaths: linesOf(pick<HTMLTextAreaElement>("#air-include-paths")?.value ?? ""),
        excludeKeywords: linesOf(pick<HTMLTextAreaElement>("#air-exclude")?.value ?? ""),
        maxDocChars: Math.max(500, number("#air-max-doc", 6000)),
        maxTotalChars: Math.max(2000, number("#air-max-total", 60000)),
      },
      range: {
        mode: (value("#air-mode") as RangeMode) || "thisWeek",
        lastNDays: Math.min(Math.max(number("#air-last-n", 7), 1), 365),
        customStart: value("#air-custom-start"),
        customEnd: value("#air-custom-end"),
      },
      output: {
        notebook: value("#air-out-notebook"),
        folder: value("#air-folder") || "/AI周报",
        titleTemplate: value("#air-title") || "{{YYYY}}-W{{WW}} 工作周报",
        openAfterCreate: pick<HTMLInputElement>("#air-open")?.checked ?? true,
        writeProvenance: pick<HTMLInputElement>("#air-provenance")?.checked ?? true,
      },
      prompt: {
        system: pick<HTMLTextAreaElement>("#air-system")?.value?.trim() || DEFAULT_SYSTEM_PROMPT,
        template: pick<HTMLTextAreaElement>("#air-template")?.value?.trim() || DEFAULT_USER_TEMPLATE,
      },
    };

    try {
      await onSave(next);
      dialog.destroy();
      showMessage(t("msgSaved"), 3000);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error), 6000, "error");
    }
  });
}
