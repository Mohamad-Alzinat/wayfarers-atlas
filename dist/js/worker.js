importScripts("../vendor/index.js");
const adapter = import("./vm-call.mjs");
const ready = (async () => {
  const base = new URL("../", self.location.href);
  const engine = await new wasmoon.LuaFactory(
    new URL("vendor/glue.wasm", base).href,
  ).createEngine();
  await engine.doString(
    "NS={} unpack=table.unpack; bit={band=function(a,b)return a&b end,bor=function(a,b)return a|b end,lshift=function(a,b)return a<<b end}",
  );
  const response = await fetch(new URL("lua/modules.json", base));
  if (!response.ok) throw Error("Could not load the Lua planner.");
  for (const module of await response.json()) {
    engine.global.set("source", module.source);
    await engine.doString('assert(load(source))("AtlasRoute",NS)');
  }
  return engine;
})();
let tasks = Promise.resolve();
self.onmessage = ({ data }) => {
  tasks = tasks.then(async () => {
    try {
      const engine = await ready;
      const { calculateInVM } = await adapter;
      const result = calculateInVM(engine, data.request);
      self.postMessage({ id: data.id, result });
    } catch (e) {
      self.postMessage({ id: data.id, error: String(e.message || e) });
    }
  });
};
