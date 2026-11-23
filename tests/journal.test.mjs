import test from "node:test";
import assert from "node:assert/strict";
import {
  sample,
  quests,
  places,
  placeById,
  graph,
  CatalogRepository,
  worldPoint,
} from "../dist/js/catalog.mjs";
import {
  QuestPlannerFacade,
  EventBus,
  Commands,
  applyEvent,
  questStatus,
} from "../dist/js/domain.mjs";
import {
  JourneyPlaybackController,
  interpolate,
} from "../dist/js/playback.mjs";
import {
  previewImport,
  fromClient,
  clientSnapshot,
} from "../dist/js/snapshots.mjs";
import { luaRouter } from "./lua-driver.mjs";
const router = await luaRouter(),
  repo = new CatalogRepository();
const request = (algorithm = "atlas", subset = quests.slice(0, 3)) => ({
  ...sample(),
  algorithm,
  graph,
  quests: subset,
});
for (const algorithm of ["atlas", "nearest", "exact"]) {
  test(
    algorithm +
      " contract: empty, single, multiple, coverage, totals, continuity",
    async () => {
      for (const subset of [[], quests.slice(0, 1), quests.slice(0, 3)]) {
        const req = request(algorithm, subset),
          r = await router.calculate(req);
        assert.equal(r.status, "ok");
        assert.equal(r.coveredCount, r.requiredCount);
        assert.equal(r.requiredCount, subset.length * 2);
        assert.equal(new Set(r.stops.map((s) => s.id)).size, r.requiredCount);
        assert.equal(r.isProvenOptimal, algorithm === "exact");
        let loc = req.profile.start,
          t = 0,
          progress = { ...req.progress };
        for (const l of r.legs) {
          assert.equal(l.from, loc);
          loc = l.to;
          t += l.seconds;
          assert.equal(l.endsAt, t);
          if (l.kind === "travel")
            assert(
              graph.edges.some(
                (e) => e.from === l.from && e.to === l.to && e.mode === l.mode,
              ),
            );
          else
            progress = applyEvent(progress, repo.get(l.quest), {
              kind: l.mode,
              objective: l.objective,
              target: l.target,
            });
        }
        assert.equal(t, r.travelSeconds + r.workSeconds);
        assert.equal(t, r.totalCostSeconds);
        for (const q of subset) assert(progress[q.id].turnedIn);
      }
    },
  );
  test(
    algorithm + " errors, disconnected destination and missing dependency",
    async () => {
      let req = request(algorithm, [quests[4]]);
      assert.equal((await router.calculate(req)).code, "prerequisite");
      req = request(algorithm, [quests[5]]);
      req.profile.boat = false;
      let r = await router.calculate(req);
      assert.equal(r.code, "unreachable");
      assert(r.uncoveredRequiredIds.includes("W06/fieldwork"));
      assert.equal(r.legs.length, 0);
    },
  );
  test(
    algorithm +
      " handles completed predecessor, partial count and cross-quest precedence",
    async () => {
      let req = request(algorithm, [quests[4], quests[1]]);
      let r = await router.calculate(req);
      assert.equal(r.status, "ok");
      assert(
        r.stops.findIndex((s) => s.id === "W02/turnin") <
          r.stops.findIndex((s) => s.id === "W05/accept"),
      );
      req = request(algorithm, [quests[0]]);
      r = await router.calculate(req);
      assert.equal(r.workSeconds, 3 * 8 + 5);
      req.progress.W01.counts.fieldwork = 4;
      r = await router.calculate(req);
      assert.deepEqual(
        r.stops.map((s) => s.kind),
        ["turnin"],
      );
    },
  );
}
test("one-way and portal gates filter Dijkstra travel; fixed optimum is known", async () => {
  const req = request("exact", [
    { ...quests[0], objectives: [], turnin: "spire" },
  ]);
  req.profile.start = "ruin";
  req.profile.portal = true;
  req.graph = {
    ...graph,
    edges: graph.edges.filter((e) => e.mode === "portal"),
  };
  assert.equal((await router.calculate(req)).code, "unreachable");
  req.profile.class = "Mage";
  const r = await router.calculate(req);
  assert.equal(r.totalCostSeconds, 13);
  assert.equal(r.legs[0].mode, "portal");
  req.profile.start = "spire";
  req.quests[0].turnin = "ruin";
  assert.equal((await router.calculate(req)).code, "unreachable");
});
test("globally budgeted one-use hearth across a chain; exact matches hand calculation", async () => {
  const req = request("exact", [
    {
      ...quests[0],
      giver: "port",
      turnin: "haven",
      objectives: [
        { ...quests[0].objectives[0], place: "port", count: 1, seconds: 1 },
      ],
    },
    {
      ...quests[1],
      giver: "port",
      requires: ["W01"],
      turnin: "haven",
      objectives: [],
    },
  ]);
  req.progress = {};
  req.profile.start = "port";
  req.profile.hearthReady = true;
  req.graph = {
    ...graph,
    edges: graph.edges.filter(
      (e) =>
        e.mode === "walk" &&
        ["port", "haven"].includes(e.from) &&
        ["port", "haven"].includes(e.to),
    ),
  };
  const r = await router.calculate(req);
  assert.equal(r.status, "ok");
  assert.equal(r.totalCostSeconds, 229);
  assert.equal(r.legs.filter((l) => l.mode === "hearth").length, 1);
});
test("exact cap, invalid coordinates, bad weights, omitted objective and zero visits", async () => {
  assert.equal(
    (await router.calculate(request("exact", quests))).code,
    "bound",
  );
  let req = request();
  req.graph = { ...graph, edges: [{ ...graph.edges[0], seconds: -1 }] };
  assert.equal((await router.calculate(req)).code, "graph");
  req = request("atlas", [{ ...quests[0], turnin: null }]);
  assert.equal((await router.calculate(req)).code, "coordinate");
  req = request("atlas", [quests[0]]);
  req.omitted = ["W01/fieldwork"];
  assert.equal((await router.calculate(req)).stops.length, 0);
});
test("validator passes in order and stops at first failure; inherited creator calls override", async () => {
  assert.equal(
    await router.lua
      .doString(`local order={}; local function h(i,err) return function() order[#order+1]=i;return err end end
 local result=NS.JourneyPlanner.chain({h(1),h(2,"halt"),h(3)})({})
 local creator=NS.JourneyPlanner.creator(function()return {calculate=function(self,m,s)return m+s end}end)
 return result..table.concat(order)..creator:run(2,5)`),
    "halt127",
  );
});
test("commands, injected fakes, subscriptions, undo and stale asynchronous response", async () => {
  const bus = new EventBus(),
    events = [];
  bus.on("route", (r) => events.push(r));
  const fake = new CatalogRepository(quests.slice(0, 1), places, graph.edges);
  let release;
  const f = new QuestPlannerFacade({
    repository: fake,
    router: { calculate: () => new Promise((r) => (release = r)) },
    bus,
    store: { save() {} },
    state: { ...sample(), selected: ["W01"] },
  });
  assert.equal(f.getAvailableQuests().length, 1);
  const pending = Commands.optimize("atlas").execute(f);
  Commands.ignore("W01").execute(f);
  release({ status: "ok" });
  assert.equal(await pending, null);
  assert.equal(f.route, null);
  f.undo();
  assert.deepEqual(f.state.selected, ["W01"]);
  Commands.mark("W01", { kind: "objective", objective: "fieldwork" }).execute(
    f,
  );
  assert.equal(f.state.progress.W01.counts.fieldwork, 2);
  Commands.reset().execute(f);
  assert(events.length >= 3);
});
test("comparison calculates measured gap on identical input and suppresses zero denominator", async () => {
  const f = new QuestPlannerFacade({
    repository: repo,
    router,
    bus: new EventBus(),
    store: { save() {} },
    state: sample(),
  });
  const [a, e] = await f.compareStrategies();
  assert.equal(
    a.gap,
    (100 * (a.totalCostSeconds - e.totalCostSeconds)) / e.totalCostSeconds,
  );
  assert(a.gap >= 0);
  assert(a.runtimeMs >= 0);
  f.select([]);
  assert((await f.compareStrategies()).every((r) => r.gap === null));
});
test("playback consumes actual returned paths, reconstructs progress when seeking backward", async () => {
  const req = request(),
    r = await router.calculate(req),
    bus = new EventBus(),
    pc = new JourneyPlaybackController(repo, bus);
  pc.reset(r, req.progress, req.profile.start);
  const initial = structuredClone(pc.state().progress);
  pc.play(10);
  pc.tick(1010);
  assert.equal(pc.time, 8);
  pc.pause(1010);
  pc.tick(5010);
  assert.equal(pc.time, 8);
  pc.play(5010);
  pc.setSpeed(2, 6010);
  pc.tick(7010);
  assert.equal(pc.time, 32);
  const l = r.legs[0];
  pc.seek(l.endsAt / 2);
  assert.deepEqual(pc.state().point, interpolate(l.path, 0.5).point);
  pc.skipLeg();
  assert.equal(pc.time, l.endsAt);
  assert.deepEqual(pc.state().progress, initial);
  pc.step(1);
  assert.equal(pc.state().progress.W01.counts.fieldwork, 4);
  pc.step(-1);
  assert.deepEqual(pc.state().progress, initial);
  pc.seek(r.totalCostSeconds);
  assert(pc.state().done);
  assert(pc.state().progress.W03.turnedIn);
  pc.seek(0);
  assert.deepEqual(pc.state().progress, initial);
  assert.deepEqual(req.progress, initial);
});
test("import bounds, dependency consistency, hostile keys and unchanged current state", () => {
  const s = sample(),
    before = JSON.stringify(s);
  assert.equal(previewImport(before, repo).origin, "Imported snapshot");
  for (const mutate of [
    (x) => (x.profile.name = "A".repeat(80)),
    (x) => (x.profile.hearth = "unknown"),
    (x) => (x.progress.W01.counts.fieldwork = 99),
    (x) => x.selected.push("bad"),
    (x) => (x.progress.W05 = { accepted: true, turnedIn: false, counts: {} }),
  ]) {
    const x = structuredClone(s);
    mutate(x);
    assert.throws(() => previewImport(JSON.stringify(x), repo));
  }
  for (const raw of ['{"__proto__":{}}', "[", before.repeat(600)])
    assert.throws(() => previewImport(raw, repo));
  assert.equal(JSON.stringify(s), before);
  const log = {
    schema: "wayfarer.questlog/1",
    capturedAt: 1795000000,
    quests: [
      {
        id: 12,
        title: "<test>",
        ready: false,
        objectives: [
          { label: "Collect", count: 2, required: 5, finished: false },
        ],
      },
    ],
  };
  const snap = previewImport(JSON.stringify(log), repo);
  assert.equal(snap.progress["game-12"].counts["objective-0"], 2);
  assert.deepEqual(snap.clientLog, log);
  assert.deepEqual(previewImport(JSON.stringify(snap), repo).clientLog, log);
});
test("zone transform is independent of viewport and state rules reject early turn-in", () => {
  assert.deepEqual(worldPoint("Mistwood", 0, 0), [0, 340]);
  assert.deepEqual(worldPoint("Eastmarch", 1, 1), [1000, 800]);
  assert.throws(() =>
    applyEvent(sample().progress, quests[0], { kind: "turnin" }),
  );
});
