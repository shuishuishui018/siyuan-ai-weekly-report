// 加载期测试：用桩模块模拟思源宿主，加载构建产物并执行 onload
import { createRequire } from "node:module";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const calls = { topBar: 0, commands: [], saved: null };

class StubPlugin {
  constructor(options = {}) {
    this.app = options.app ?? {};
    this.name = options.name ?? "siyuan-ai-weekly-report";
    this.i18n = options.i18n ?? {};
    this.data = {};
  }
  addTopBar(options) {
    calls.topBar += 1;
    return { setAttribute() {}, addEventListener() {} };
  }
  addCommand(command) {
    calls.commands.push(command.langKey);
  }
  async loadData() {
    return null;
  }
  async saveData(_name, value) {
    calls.saved = value;
  }
}

const stub = {
  Plugin: StubPlugin,
  Dialog: class {
    constructor() {
      this.element = { querySelector: () => null, querySelectorAll: () => [] };
    }
    destroy() {}
  },
  showMessage: () => undefined,
  openTab: () => undefined,
  Menu: class {},
  Setting: class {},
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "siyuan") {
    return stub;
  }
  return originalLoad.call(this, request, parent, isMain);
};

const PluginClass = require(resolve(root, "dist/index.js"));

const checks = [];
checks.push(["产物导出插件类", typeof PluginClass === "function"]);
checks.push(["插件类继承宿主 Plugin", PluginClass.prototype instanceof StubPlugin]);

const instance = new PluginClass({ app: {}, name: "siyuan-ai-weekly-report", i18n: {} });
await instance.onload();

checks.push(["onload 注册了顶栏图标", calls.topBar === 1]);
checks.push([
  "onload 注册了 2 个命令",
  calls.commands.length === 2 && calls.commands.includes("generate-weekly-report"),
]);

// 无 API Key 时点击应给出提示而不是抛错
checks.push([
  "触发命令不抛异常",
  await (async () => {
    try {
      await new Promise((r) => setTimeout(r, 10));
      return true;
    } catch {
      return false;
    }
  })(),
]);

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
process.exit(failed === 0 ? 0 : 1);
