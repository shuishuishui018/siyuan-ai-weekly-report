import { openTab, Plugin, showMessage } from "siyuan";
import { t } from "./i18n";
import { generateWeeklyReport } from "./report";
import { openSettingsDialog } from "./settings";
import { mergeSettings, type PluginSettings } from "./types";

const STORAGE_NAME = "settings.json";
const MESSAGE_ID = "ai-weekly-report";

const TOP_ICON = `<svg viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg"><path d="M8 4h11l5 5v19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M19 4v6h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M11 15h8M11 19h8M11 23h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M23.6 19.2l1.1 2.6 2.6 1.1-2.6 1.1-1.1 2.6-1.1-2.6-2.6-1.1 2.6-1.1z" fill="currentColor"/></svg>`;

export default class AIWeeklyReport extends Plugin {
  private settings: PluginSettings = mergeSettings(null);
  private running = false;

  async onload() {
    try {
      this.settings = mergeSettings(await this.loadData(STORAGE_NAME));
    } catch {
      this.settings = mergeSettings(null);
    }

    this.addTopBar({
      id: "ai-weekly-report",
      icon: TOP_ICON,
      title: t("topBarTitle"),
      position: "right",
      callback: () => {
        void this.run();
      },
    });

    this.addCommand({
      langKey: "generate-weekly-report",
      langText: t("cmdGenerate"),
      callback: () => {
        void this.run();
      },
    });

    this.addCommand({
      langKey: "open-weekly-report-settings",
      langText: t("cmdSettings"),
      callback: () => {
        void this.openSettings();
      },
    });
  }

  async onunload() {
    this.running = false;
  }

  private notify(text: string, timeout = 4000, type?: "info" | "error") {
    showMessage(text, timeout, type, MESSAGE_ID);
  }

  async openSettings() {
    await openSettingsDialog(this.settings, async (next) => {
      this.settings = next;
      await this.saveData(STORAGE_NAME, next);
    });
  }

  private async run() {
    if (this.running) {
      this.notify(t("msgRunning"), 3000);
      return;
    }
    if (!this.settings.ai.apiBaseUrl || !this.settings.ai.model) {
      this.notify(t("msgNeedApiKey"), 6000, "error");
      void this.openSettings();
      return;
    }

    this.running = true;
    try {
      const result = await generateWeeklyReport(this.settings, (text) => {
        this.notify(text, 120000);
      });
      this.notify(t("msgDone", { title: result.title, count: result.docCount }), 6000);
      if (this.settings.output.openAfterCreate && result.docId) {
        try {
          openTab({ app: this.app, doc: { id: result.docId, zoomIn: false } });
        } catch {
          // 打开失败不影响已生成的文档
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notify(t("msgFailed", { error: message }), 10000, "error");
      console.error("[ai-weekly-report]", error);
    } finally {
      this.running = false;
    }
  }
}
