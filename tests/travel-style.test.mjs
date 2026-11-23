import test from "node:test";
import assert from "node:assert/strict";
import { luaRouter } from "./lua-driver.mjs";
import { allowedQuest } from "../dist/js/journal-style.mjs";
const bridge = await luaRouter();
const places = ["a", "b", "c", "isle"].map((id) => ({ id }));
const edge = (from, to, seconds, mode = "walk") => ({
  from,
  to,
  seconds,
  mode,
});
const graph = {
  version: "fixture",
  places,
  edges: [
    edge("a", "b", 120),
    edge("a", "b", 10, "fly"),
    edge("b", "c", 60),
    edge("b", "c", 10, "fly"),
    edge("c", "isle", 15, "boat"),
  ],
};
const visit = (id, place) => ({
  id,
  title: id,
  giver: place,
  turnin: place,
  requires: [],
  objectives: [],
  navigationOnly: true,
});
function plan(style, overseas = false) {
  return bridge.calculate({
    graph,
    algorithm: "exact",
    profile: {
      travelPreset: style,
      start: "a",
      hearth: "a",
      class: "Warrior",
      faction: "Alliance",
      knownSpells: [],
    },
    progress: {},
    quests: [
      visit("one", "b"),
      visit("two", "c"),
      ...(overseas ? [visit("three", "isle")] : []),
    ],
  });
}
test("three presets produce distinct actual edges and durations", async () => {
  const foot = await plan("foot"),
    mixed = await plan("mixed"),
    full = await plan("full");
  assert.deepEqual(
    [foot.travelSeconds, mixed.travelSeconds, full.travelSeconds],
    [180, 70, 20],
  );
  assert.equal(mixed.travelStyle.transportTrips, 1);
  assert.equal(mixed.travelStyle.eligibleTrips, 2);
  assert.deepEqual(
    mixed.legs.filter((l) => l.kind === "travel").map((l) => l.mode),
    ["fly", "walk"],
  );
  assert.equal(mixed.isProvenOptimal, false);
  for (const result of [foot, mixed, full]) {
    let elapsed = 0;
    for (const leg of result.legs) {
      elapsed += leg.seconds;
      assert.equal(leg.endsAt, elapsed);
    }
    assert.equal(result.totalCostSeconds, elapsed);
    assert.equal(result.stops.at(-1).endsAt, elapsed);
  }
});
test("mixed reserves necessary crossings and rounds odd trip counts up", async () => {
  const r = await plan("mixed", true);
  assert.equal(r.status, "ok");
  assert.deepEqual(r.travelStyle, {
    preset: "mixed",
    transportTrips: 2,
    eligibleTrips: 3,
    mandatoryTrips: 1,
  });
  assert.deepEqual(
    r.legs.filter((l) => l.kind === "travel").map((l) => l.mode),
    ["fly", "walk", "boat"],
  );
  assert.equal((await plan("foot", true)).code, "unreachable");
});
test("journal excludes opposing and unclassified catalog records on both sides", () => {
  for (const faction of ["Alliance", "Horde"]) {
    const other = faction === "Alliance" ? "Horde" : "Alliance";
    assert.ok(allowedQuest({ faction }, faction));
    assert.ok(allowedQuest({ record: { side: "Both" } }, faction));
    assert.ok(!allowedQuest({ faction: other }, faction));
    assert.ok(!allowedQuest({ record: { side: null } }, faction));
  }
});
