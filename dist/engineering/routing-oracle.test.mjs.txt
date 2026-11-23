import assert from "node:assert/strict";
import test from "node:test";
import { luaRouter } from "./lua-driver.mjs";

const router = await luaRouter();
const places = ["a", "b", "c", "d"];
function fixture(seed) {
  let state = seed;
  function random(limit) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor((state / 4294967296) * limit);
  }
  const edges = [];
  for (const from of places)
    for (const to of places) {
      if (to === from) continue;
      if (random(100) < 60)
        edges.push({ from, to, mode: "walk", seconds: random(15) });
      if (random(100) < 32)
        edges.push({
          from,
          to,
          mode: "boat",
          seconds: random(9),
          faction: random(3) === 0 ? "Horde" : "Alliance",
        });
    }
  const profile = {
    start: "a",
    faction: "Alliance",
    class: "Warrior",
    boat: seed % 3 !== 0,
    hearthReady: seed % 2 === 0,
    hearth: "d",
    travelPreset: "custom",
  };
  const partial = seed % 3 === 1,
    chain = seed % 2 === 1;
  const quests = [
    {
      id: "Q",
      title: "First",
      giver: "a",
      turnin: "c",
      requires: [],
      objectives: [
        { id: "item", label: "Gather", place: "b", count: 2, seconds: 3 },
      ],
    },
    {
      id: "R",
      title: "Second",
      giver: "c",
      turnin: "b",
      requires: chain ? ["Q"] : [],
      objectives: [
        { id: "item", label: "Collect", place: "d", count: 1, seconds: 2 },
      ],
    },
  ];
  // Explicit expected services, independent of the Lua quest transformation.
  const services = [];
  function service(id, place, seconds, after = []) {
    services.push({ id, place, seconds, after });
  }
  if (!partial) service("Q/accept", "a", 4);
  service("Q/item", "b", partial ? 3 : 6, partial ? [] : ["Q/accept"]);
  service("Q/turnin", "c", 5, ["Q/item"]);
  service("R/accept", "c", 4, chain ? ["Q/turnin"] : []);
  service("R/item", "d", 2, ["R/accept"]);
  service("R/turnin", "b", 5, ["R/item"]);
  const travel = edges.filter(
    (e) => e.mode === "walk" || (profile.boat && e.faction === profile.faction),
  );
  if (profile.hearthReady)
    for (const from of places)
      travel.push({ from, to: "d", mode: "hearth", seconds: 10 });
  return {
    req: {
      graph: { version: "oracle", places: places.map((id) => ({ id })), edges },
      profile,
      quests,
      progress: partial ? { Q: { accepted: true, counts: { item: 1 } } } : {},
    },
    services,
    travel,
  };
}

// Exhaust the raw state space by repeated relaxation. No shortest-path matrices,
// tour ordering, resource code or service definitions come from the planners.
function optimum(f) {
  const index = new Map(f.services.map((s, i) => [s.id, i]));
  const masks = 2 ** f.services.length;
  const key = (place, mask, used) =>
    (mask * places.length + places.indexOf(place)) * 2 + used;
  const distance = Array(masks * places.length * 2).fill(Infinity);
  distance[key("a", 0, 0)] = 0;
  let changed;
  do {
    changed = false;
    for (let mask = 0; mask < masks; mask++)
      for (const place of places)
        for (const used of [0, 1]) {
          const cost = distance[key(place, mask, used)];
          if (!Number.isFinite(cost)) continue;
          function relax(next, seconds) {
            if (cost + seconds < distance[next]) {
              distance[next] = cost + seconds;
              changed = true;
            }
          }
          for (const e of f.travel) {
            if (e.from !== place || (used && e.mode === "hearth")) continue;
            relax(key(e.to, mask, e.mode === "hearth" ? 1 : used), e.seconds);
          }
          for (const [i, s] of f.services.entries()) {
            if (
              s.place !== place ||
              mask & (1 << i) ||
              s.after.some((id) => !(mask & (1 << index.get(id))))
            )
              continue;
            relax(key(place, mask | (1 << i), used), s.seconds);
          }
        }
  } while (changed);
  return Math.min(...distance.slice(key("a", masks - 1, 0)));
}

function verifyItinerary(f, r) {
  let at = "a",
    travel = 0,
    work = 0,
    hearth = 0;
  const done = new Set();
  for (const leg of r.legs) {
    assert.equal(leg.from, at);
    at = leg.to;
    if (leg.kind === "travel") {
      assert.ok(
        f.travel.some(
          (e) =>
            e.from === leg.from &&
            e.to === at &&
            e.mode === leg.mode &&
            e.seconds === leg.seconds,
        ),
      );
      if (leg.mode === "hearth") hearth++;
      travel += leg.seconds;
    } else {
      const s = f.services.find((s) => s.id === leg.stopId);
      assert.ok(s && !done.has(s.id) && s.after.every((id) => done.has(id)));
      assert.equal(leg.from, leg.to);
      assert.equal(at, s.place);
      assert.equal(leg.seconds, s.seconds);
      assert.equal(r.stops[done.size].id, s.id);
      assert.equal(r.stops[done.size].endsAt, leg.endsAt);
      done.add(s.id);
      work += s.seconds;
    }
    assert.equal(leg.endsAt, travel + work);
  }
  assert.ok(hearth <= 1);
  assert.equal(done.size, f.services.length);
  assert.equal(r.coveredCount, done.size);
  assert.equal(r.requiredCount, done.size);
  assert.equal(r.travelSeconds, travel);
  assert.equal(r.workSeconds, work);
  assert.equal(r.totalCostSeconds, travel + work);
}

test("48 directed quest graphs against independent exhaustive state search", async (t) => {
  const stats = {
    feasible: 0,
    impossible: 0,
    atlas: { optimal: 0, longer: 0, missed: 0 },
    nearest: { optimal: 0, longer: 0, missed: 0 },
  };
  for (let seed = 1; seed <= 48; seed++) {
    const f = fixture(seed),
      best = optimum(f);
    stats[Number.isFinite(best) ? "feasible" : "impossible"]++;
    for (const algorithm of ["exact", "atlas", "nearest"]) {
      const r = await router.calculate({ ...f.req, algorithm });
      const context = "seed " + seed + " / " + algorithm;
      if (r.status === "error") {
        assert.equal(r.legs.length, 0, context);
        if (algorithm === "exact" || r.code === "unreachable")
          assert.equal(best, Infinity, context);
        assert.ok(["no_extension", "unreachable"].includes(r.code), context);
        if (Number.isFinite(best)) stats[algorithm].missed++;
        continue;
      }
      assert.equal(r.status, "ok", context);
      verifyItinerary(f, r);
      assert.ok(r.totalCostSeconds >= best, context);
      assert.equal(r.isProvenOptimal, algorithm === "exact", context);
      if (algorithm === "exact")
        assert.equal(r.totalCostSeconds, best, context);
      else
        stats[algorithm][r.totalCostSeconds === best ? "optimal" : "longer"]++;
    }
  }
  assert.ok(stats.feasible > 0 && stats.impossible > 0);
  t.diagnostic(JSON.stringify(stats));
});

test("a Mage on an independent map only gets destinations defined on that map", async () => {
  const { req } = fixture(4);
  const r = await router.calculate({
    ...req,
    quests: [],
    algorithm: "exact",
    profile: {
      ...req.profile,
      class: "Mage",
      travelPreset: "full",
      device: true,
    },
  });
  assert.equal(r.status, "ok");
  assert.equal(r.totalCostSeconds, 0);
});

test("missing coordinates only block outstanding services", async () => {
  const { req } = fixture(4);
  const q = {
    ...req.quests[0],
    giver: "unknown",
    objectives: [{ ...req.quests[0].objectives[0], place: "unknown" }],
  };
  const run = (n) =>
    router.calculate({
      ...req,
      algorithm: "exact",
      quests: [q],
      progress: { Q: { accepted: true, counts: { item: n } } },
    });
  assert.equal((await run(2)).status, "ok");
  assert.equal((await run(1)).code, "coordinate");
});
