import test from "node:test";
import assert from "node:assert/strict";
import { luaRouter } from "./lua-driver.mjs";
import { sample, graph, quests } from "../dist/js/catalog.mjs";
const router = await luaRouter();
test("local service-chain lookahead can choose a different first quest from nearest", async () => {
  const road = (from, to, seconds) => ({ from, to, seconds, mode: "walk" });
  const q = (base, site, turnin) => ({
    ...base,
    turnin,
    objectives: [{ ...base.objectives[0], place: site, count: 1, seconds: 1 }],
  });
  const state = sample();
  state.progress.W01.counts.fieldwork = 0;
  const req = {
    ...state,
    graph: {
      ...graph,
      edges: [
        road("haven", "wood", 5),
        road("haven", "port", 12),
        road("wood", "port", 150),
        road("port", "wood", 20),
        road("wood", "spire", 120),
        road("spire", "port", 150),
      ],
    },
    quests: [q(quests[0], "wood", "spire"), q(quests[1], "port", "port")],
  };
  const atlas = await router.calculate({ ...req, algorithm: "atlas" }),
    nearest = await router.calculate({ ...req, algorithm: "nearest" });
  assert.equal(atlas.stops[0].quest, "W02");
  assert.equal(nearest.stops[0].quest, "W01");
  assert(atlas.totalCostSeconds < nearest.totalCostSeconds);
});
test("repeated calls release the VM result slot", async () => {
  const top = router.lua.global.getTop();
  const req = {
    ...sample(),
    graph,
    quests: quests.slice(0, 3),
    algorithm: "atlas",
  };
  for (let i = 0; i < 180; i++) {
    assert.equal((await router.calculate(req)).totalCostSeconds, 606);
    assert.equal(router.lua.global.getTop(), top);
  }
});
