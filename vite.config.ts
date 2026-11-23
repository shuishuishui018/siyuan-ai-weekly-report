import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node16",
    minify: "esbuild",
    sourcemap: false,
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: "src/index.ts",
      formats: ["cjs"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      // 思源以 CommonJS 方式加载插件，external 掉宿主注入的 siyuan 模块
      external: ["siyuan", "process", "fs", "path", "os"],
    },
  },
});
