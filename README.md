# AI Weekly Report for SiYuan

Turn scattered daily work logs into a structured weekly report with AI — in one click.

The plugin reads the notes you wrote during a period, sends them to an OpenAI-compatible model, and creates a new weekly report document inside SiYuan.

> 中文说明见 [README_zh_CN.md](./README_zh_CN.md)

## Platforms

Works on desktop (Windows / macOS / Linux), in the browser, and on mobile (Android / iOS). On phones the settings panel collapses to a single column and the generated document opens right away.

## Features

- **Automatic collection** — picks up documents by their last update time, filtered by notebook and path (e.g. `/工作日志`, `/每日待办`).
- **Sensitive documents are skipped** — any document whose path matches the exclusion keywords (default: `账号密码`, `密码`, `密钥`, `token`, `secret`) is never read and never sent to the model.
- **Open task extraction** — unchecked tasks such as `- [ ] Follow up @11-25` are gathered into a task list so they land in *In progress* or *Next week* instead of being lost.
- **Structured output** — *Done this week / In progress / Risks / Next week* by default; the system prompt and the output structure are fully editable.
- **Any OpenAI-compatible endpoint** — DeepSeek, OpenAI, Qwen/DashScope, Moonshot, Zhipu, SiliconFlow, Ollama, LM Studio. Requests go through the SiYuan kernel proxy, so no browser CORS issues.
- **Configurable period** — this week, last week, last N days, or a custom range.

## Installation

### From the marketplace

Open **Settings → Marketplace → Plugins**, search for *AI Weekly Report* (「AI 周报生成器」), install and enable it.

### Manually

1. Download `package.zip` from the [latest release](../../releases/latest).
2. Unzip it into `{workspace}/data/plugins/siyuan-ai-weekly-report/` so that `plugin.json` sits directly in that folder.
3. Restart SiYuan or use **Settings → Marketplace → Downloaded → Reload**.

## Configuration

Open **Settings → AI Weekly Report** (or run the command *AI Weekly Report Settings*).

| Field | Notes |
| --- | --- |
| API base URL | `https://api.deepseek.com/v1`, `https://api.openai.com/v1`, `http://127.0.0.1:11434/v1` … |
| API key | Stored in the plugin's local data only. Leave empty for local models. |
| Model | `deepseek-chat`, `gpt-4o-mini`, `qwen2.5:14b` … |
| Included paths | One per line, fuzzy matched against document paths. `/工作日志` matches `/工作日志/2026年/11月/17日周会记录`. |
| Excluded keywords | Documents whose path matches are skipped. Keep credential-related words here. |
| Period | This week / last week / last N days / custom range. |

Click the top-bar icon or run the command **Generate AI Weekly Report** to create the report. The document is created under your chosen folder (default `/AI周报`) with a title like `2026-W47 工作周报`, then opened automatically.

## How the material is built

Each collected document becomes:

```
### /工作日志/2026年/11月/17日周会记录（更新于 2026-11-17）
<document body without YAML frontmatter>
```

Documents are truncated per-document (`Max chars per document`) and overall (`Max total chars`); once the total limit is reached, older documents are dropped.

## Privacy

- The API key is stored in the plugin's own `data/storage/petal` file on your machine.
- Collected document text is sent **only** to the API endpoint you configure.
- Documents matching the exclusion keywords are filtered out before anything is read or sent. Review your exclusion list before the first run.

## Development

```bash
npm install
npm run dev      # watch build into dist/
npm run build    # tsc + vite build + package.zip
node scripts/run-smoke.mjs   # end-to-end smoke test against a running kernel
```

To debug with a live SiYuan instance, place the built `index.js`, `plugin.json`, `index.css` and `i18n/` in `{workspace}/data/plugins/siyuan-ai-weekly-report/`.

## License

MIT
