import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gameCatalog, gameSample, GAME_VERSION } from "../dist/js/azeroth.mjs";
import { applyEvent } from "../dist/js/domain.mjs";
import { luaRouter } from "./lua-driver.mjs";
const file = (name) =>
  JSON.parse(
    readFileSync(new URL("../dist/data/" + name + ".json", import.meta.url)),
  );
const raw = file("quests"),
  data = gameCatalog(file("azeroth"), raw),
  bridge = await luaRouter();
const foot = {
  ...gameSample().profile,
  travelPreset: "custom",
  mount: false,
  boat: false,
  zeppelin: false,
  fly: false,
  skyship: false,
  tram: false,
  portal: false,
  teleport: false,
  device: false,
  hearthReady: false,
};
function route(start, end, methods = {}, algorithm = "atlas") {
  const q = {
    id: "visit",
    title: "Test waypoint",
    giver: end,
    turnin: end,
    navigationOnly: true,
    objectives: [],
    requires: [],
  };
  return bridge.calculate({
    graph: { version: GAME_VERSION, places: data.places, edges: [] },
    profile: { ...foot, start, ...methods },
    quests: [q],
    progress: {},
    algorithm,
  });
}
test("the indexed catalog and complete repository projection have unique identities", () => {
  assert.equal(raw.quests.length, 4753);
  assert.equal(data.places.length, 76);
  assert.equal(data.quests.filter((q) => !q.navigationOnly).length, 16);
  assert.equal(new Set(data.quests.map((q) => q.id)).size, data.quests.length);
  assert.equal(
    new Set(data.quests.map((q) => q.gameId).filter(Boolean)).size,
    4753,
  );
  for (const p of data.places)
    assert.ok(
      p.point[0] >= 0 &&
        p.point[0] <= 1000 &&
        p.point[1] >= 0 &&
        p.point[1] <= 800,
    );
});
test("ocean crossing requires a permitted method and never marks a staging quest complete", async () => {
  assert.equal((await route("ratchet", "bootybay")).code, "unreachable");
  for (const strategy of ["atlas", "nearest", "exact"]) {
    const r = await route("ratchet", "bootybay", { boat: true }, strategy);
    assert.equal(r.status, "ok");
    assert.equal(r.travelSeconds, 330);
    assert.deepEqual(
      r.legs.map((l) => l.mode),
      ["boat", "visit"],
    );
    assert.deepEqual(applyEvent({}, { id: "visit" }, { kind: "visit" }), {});
  }
});
test("road distance and costs use profile speed, faction and flight discoveries", async () => {
  const a = await route("stormwind", "ironforge"),
    b = await route("stormwind", "ironforge", { mount: true });
  assert.ok(Math.abs(a.travelSeconds / b.travelSeconds - 1.6) < 1e-9);
  const tram = await route("stormwind", "ironforge", { tram: true });
  assert.ok(tram.legs.some((l) => l.mode === "tram"));
  const h = await route("stormwind", "ironforge", {
    tram: true,
    faction: "Horde",
  });
  assert.ok(h.legs.every((l) => l.mode !== "tram"));
  const f = await route("stormwind", "ironforge", { fly: true });
  assert.ok(f.legs.some((l) => l.mode === "fly"));
  assert.ok(f.legs.every((l) => data.places.some((p) => p.id === l.to)));
  const locked = await route("stormwind", "ironforge", {
    fly: true,
    knownFlights: [],
  });
  assert.equal(locked.travelSeconds, a.travelSeconds);
});
test("ferries, zeppelins, skyships and fixed portals follow their own rules", async () => {
  const sky = await route("valanaar", "dalaran", { skyship: true });
  assert.equal(sky.legs[0].mode, "skyship");
  assert.equal(
    (await route("valanaar", "dalaran", { boat: true })).code,
    "unreachable",
  );
  const zep = await route("orgrimmar", "undercity", {
    zeppelin: true,
    faction: "Horde",
  });
  assert.equal(zep.legs[0].mode, "zeppelin");
  assert.equal(
    (await route("orgrimmar", "undercity", { zeppelin: true })).code,
    "unreachable",
  );
  const portal = await route("ruttheran", "darnassus", { portal: true });
  assert.equal(portal.legs[0].mode, "portal");
  const shaman = await route("ratchet", "stormwind", {
    class: "Shaman",
    teleport: true,
    hearth: "stormwind",
    knownSpells: [556],
  });
  assert.equal(shaman.legs[0].methodName, "Astral Recall");
});
test("mage learned spells and separate item permissions gate teleports", async () => {
  const p = { teleport: true, class: "Mage", knownSpells: [3561] };
  const r = await route("ratchet", "stormwind", p);
  assert.equal(r.travelSeconds, 10);
  assert.equal(r.legs[0].mode, "teleport");
  assert.equal(
    (await route("ratchet", "stormwind", { ...p, knownSpells: [] })).code,
    "unreachable",
  );
  assert.equal(
    (await route("ratchet", "stormwind", { ...p, class: "Hunter" })).code,
    "unreachable",
  );
  const d = await route("stormwind", "everlook", {
    device: true,
    ripper: true,
  });
  assert.equal(d.legs[0].mode, "device");
  assert.equal(
    (await route("stormwind", "everlook", { device: true })).code,
    "unreachable",
  );
});
