import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Project Workspace shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Project Workspace<\/title>/i);
  assert.match(html, /Loading your project workspace/);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Starter Project/i);
});

test("ships an installable offline manifest and service worker", async () => {
  const [manifestText, serviceWorker] = await Promise.all([
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.name, "Project Workspace");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  assert.match(serviceWorker, /project-workspace-v1/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\(`\$\{APP_PATH\}\/api\/`\)/);
  assert.match(serviceWorker, /notificationclick/);
});
