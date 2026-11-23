import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const files = [
  "core/bits",
  "core/heap",
  "core/world",
  "core/router",
  "core/tour",
  "data/world_data",
  "data/quest_data",
  "journey/json",
  "journey/travel_style",
  "journey/planner",
];
await mkdir(path.join(root, "dist/lua"), { recursive: true });
const modules = await Promise.all(
  files.map(async (name) => ({
    name,
    source: await readFile(
      path.join(root, "AtlasRoute", name + ".lua"),
      "utf8",
    ),
  })),
);
await writeFile(
  path.join(root, "dist/lua/modules.json"),
  JSON.stringify(modules),
);
let legacy = await readFile(path.join(root, "web/AtlasRoute.html"), "utf8");
legacy = legacy
  .replace(
    /"https:\/\/cdn\.jsdelivr\.net\/npm\/wasmoon@1\.16\.0\/dist\/(index\.js|glue\.wasm)"/g,
    (_, file) => 'new URL("vendor/' + file + '",location.href).href',
  )
  .replace(/<link[^>]*https:\/\/fonts\.g[^>]*>/g, "");
await writeFile(path.join(root, "dist/legacy.html"), legacy);
await mkdir(path.join(root, "dist/engineering"), { recursive: true });
for (const [from, to] of [
  ["AtlasRoute/journey/planner.lua", "planner.lua.txt"],
  ["docs/catalog-source.md", "catalog-source.md"],
  ["tools/catalog/build_catalog.py", "build_catalog.py"],
  ["tests/journal.test.mjs", "journal.test.mjs.txt"],
  ["tests/routing-oracle.test.mjs", "routing-oracle.test.mjs.txt"],
  ...["architecture", "algorithms", "verification"].map((name) => [
    "docs/" + name + ".md",
    name + ".md",
  ]),
])
  await copyFile(
    path.join(root, from),
    path.join(root, "dist/engineering", to),
  );
