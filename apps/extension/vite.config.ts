import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const firefox = process.env.FOLIYO_BROWSER === "firefox";

/** Svelte 5 stamps static templates via innerHTML; AMO flags that assignment. */
function amoSafeTemplates(): Plugin {
  const helper = `function __foliyoSetTemplateHTML(el,html){var s=typeof html==="string"?html:String(html);var doc=new DOMParser().parseFromString("<div id=\\"__foliyo_tpl\\">"+s+"</div>","text/html");var root=doc.getElementById("__foliyo_tpl");var content=el.content;while(content.firstChild)content.removeChild(content.firstChild);if(root)while(root.firstChild)content.appendChild(root.firstChild)}`;
  return {
    name: "amo-safe-templates",
    generateBundle(_opts, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk" || chunk.fileName !== "popup.js") continue;
        if (!chunk.code.includes(".innerHTML=")) continue;
        const next = chunk.code.replace(
          /(\w+)\.innerHTML=(.+),(\w+)\.content/g,
          "(__foliyoSetTemplateHTML($1,$2),$3.content)",
        );
        if (next === chunk.code) {
          this.error("popup.js still assigns innerHTML; AMO will warn — update amoSafeTemplates()");
        }
        chunk.code = `${helper};${next}`;
      }
    },
  };
}

function firefoxManifest(): Plugin {
  return {
    name: "firefox-manifest",
    closeBundle() {
      if (!firefox) return;
      const path = resolve(__dirname, "dist/manifest.json");
      const manifest = JSON.parse(readFileSync(path, "utf8")) as {
        background?: { service_worker?: string; scripts?: string[]; type?: string };
      };
      if (manifest.background) delete manifest.background.service_worker;
      writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
    },
  };
}

export default defineConfig({
  plugins: [
    svelte({ configFile: resolve(__dirname, "svelte.config.js") }),
    amoSafeTemplates(),
    firefoxManifest(),
  ],
  root: resolve(__dirname, "src"),
  publicDir: resolve(__dirname, "public"),
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup.html"),
        background: resolve(__dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
