import { calculateInVM } from "../dist/js/vm-call.mjs";
import { readFileSync } from "node:fs";

import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const { LuaFactory } = require("../dist/vendor/index.js");
export async function luaRouter() {
  const lua = await new LuaFactory(
    path.join(root, "dist/vendor/glue.wasm"),
  ).createEngine();
  await lua.doString(
    "NS={} unpack=table.unpack; bit={band=function(a,b)return a&b end,bor=function(a,b)return a|b end,lshift=function(a,b)return a<<b end}",
  );
  for (const m of JSON.parse(
    readFileSync(path.join(root, "dist/lua/modules.json"), "utf8"),
  )) {
    lua.global.set("src", m.source);
    await lua.doString('assert(load(src))("AtlasRoute",NS)');
  }
  return {
    lua,
    async calculate(request) {
      return calculateInVM(lua, request);
    },
  };
}
