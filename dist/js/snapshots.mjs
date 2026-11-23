import { VERSION, defaultProfile, sample } from "./catalog.mjs";
const fail = (msg) => {
  throw Error(msg);
};
const object = (x) => x && typeof x === "object" && !Array.isArray(x);
const validText = (s, n = 160) =>
  typeof s === "string" && s.trim().length > 0 && s.length <= n;
const integer = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
function boundedJSON(raw) {
  if (typeof raw !== "string" || new TextEncoder().encode(raw).length > 256000)
    fail("Snapshot exceeds the 256 KB limit.");
  let x;
  try {
    x = JSON.parse(raw);
  } catch {
    fail("This file is not valid JSON.");
  }
  let total = 0;
  function inspect(n, depth) {
    if (depth > 12 || ++total > 12000)
      fail("Snapshot nesting or size exceeds the limit.");
    if (typeof n === "string" && n.length > 1000)
      fail("A text field is too long.");
    if (n && typeof n === "object")
      for (const [k, v] of Object.entries(n)) {
        if (
          ["__proto__", "constructor", "prototype"].includes(k) ||
          k.length > 100
        )
          fail("Unsupported property.");
        inspect(v, depth + 1);
      }
  }
  inspect(x, 0);
  return x;
}
export function clientSnapshot(x) {
  if (
    !Array.isArray(x.quests) ||
    x.quests.length > 100 ||
    !integer(x.capturedAt, 0, 4102444800)
  )
    fail("Invalid quest-log header.");
  const ids = new Set();
  const rows = x.quests.map((q) => {
    if (
      !object(q) ||
      !integer(q.id, 1, 99999999) ||
      ids.has(q.id) ||
      !validText(q.title) ||
      typeof q.ready !== "boolean" ||
      !Array.isArray(q.objectives) ||
      q.objectives.length > 16
    )
      fail("Invalid or duplicate client quest.");
    ids.add(q.id);
    return {
      id: q.id,
      title: q.title,
      ready: q.ready,
      objectives: q.objectives.map((o) => {
        if (
          !object(o) ||
          !validText(o.label, 500) ||
          !integer(o.count, 0, 100000) ||
          !integer(o.required, 0, 100000) ||
          typeof o.finished !== "boolean" ||
          (o.required > 0 && o.count > o.required)
        )
          fail("Invalid client objective.");
        return {
          label: o.label,
          count: o.count,
          required: o.required,
          finished: o.finished,
        };
      }),
    };
  });
  return {
    schema: "wayfarer.questlog/1",
    capturedAt: x.capturedAt,
    quests: rows,
  };
}
// The raw log remains distinct from the mapped sandbox used for simulation.
export function mappedQuests(log, placements = {}) {
  return (log?.quests || [])
    .map((q) => ({
      id: "game-" + q.id,
      title: q.title,
      level: null,
      zone: "Imported quest",
      source: "Imported quest log",
      confidence: "unknown",
      icon: "scroll",
      requires: [],
      giver: placements["game-" + q.id + "/turnin"] || null,
      turnin: placements["game-" + q.id + "/turnin"] || null,
      objectives: q.objectives.map((o, i) => ({
        id: "objective-" + i,
        label: o.label,
        unit: "items",
        count: o.required || Math.max(1, o.count),
        seconds: 10,
        place: placements["game-" + q.id + "/objective-" + i] || null,
      })),
      clientId: q.id,
    }))
    .map((q) => {
      const raw = log.quests.find((r) => r.id === q.clientId);
      if (
        !raw.ready &&
        raw.objectives.every(
          (o) => o.finished || (o.required > 0 && o.count >= o.required),
        )
      ) {
        q.objectives.push({
          id: "confirmation",
          label: "Manually confirm outstanding quest requirements",
          unit: "confirmation",
          count: 1,
          seconds: 4,
          place: placements[q.id + "/confirmation"] || null,
        });
      }
      return q;
    });
}
export function fromClient(log, makeSample = sample) {
  const s = makeSample();
  s.selected = [];
  s.omitted = [];
  s.progress = {};
  s.clientLog = log;
  s.placements = {};
  s.origin = "Imported snapshot";
  for (const q of log.quests) {
    s.progress["game-" + q.id] = {
      accepted: true,
      turnedIn: false,
      counts: Object.fromEntries(
        q.objectives.map((o, i) => [
          "objective-" + i,
          o.finished ? o.required || Math.max(1, o.count) : o.count,
        ]),
      ),
    };
  }
  return s;
}
export function previewImport(raw, repo) {
  const x = boundedJSON(raw);
  if (!object(x)) fail("Expected a snapshot object.");
  if (x.schema === "wayfarer.questlog/1")
    return fromClient(clientSnapshot(x), repo.makeSample);
  if (
    x.schema !== "wayfarer.journal/1" ||
    x.graph !== (repo.version || VERSION)
  )
    fail("Unsupported snapshot schema or map version.");
  const prof = x.profile;
  if (
    !object(prof) ||
    !validText(prof.name, 60) ||
    !["Alliance", "Horde"].includes(prof.faction) ||
    ![
      "Hunter",
      "Mage",
      "Warrior",
      "Shaman",
      "Druid",
      "Rogue",
      "Priest",
      "Paladin",
      "Warlock",
    ].includes(prof.class)
  )
    fail("Invalid character profile.");
  if (!repo.location(prof.start) || !repo.location(prof.hearth))
    fail("Unknown start or hearthstone location.");
  const profile = {};
  if (prof.travelPreset !== undefined) {
    if (!["foot", "mixed", "full", "custom"].includes(prof.travelPreset))
      fail("Unknown travel style.");
    profile.travelPreset = prof.travelPreset;
  }
  for (const [k, v] of Object.entries(defaultProfile)) {
    if (typeof prof[k] !== typeof v) fail("Invalid profile field " + k);
    profile[k] = prof[k];
  }
  if (repo.version === "azeroth-v1") {
    for (const key of ["skyship", "ripper", "transporter"]) {
      if (typeof prof[key] !== "boolean") fail("Invalid movement permission.");
      profile[key] = prof[key];
    }
    for (const [key, allowed] of [
      ["knownFlights", repo.masters],
      ["knownSpells", repo.spells],
    ]) {
      if (prof[key] === undefined) continue;
      const valid = new Set(allowed.map((v) => v.id));
      if (
        !Array.isArray(prof[key]) ||
        prof[key].length > valid.size ||
        prof[key].some((id) => !valid.has(id))
      )
        fail("Unknown travel unlock.");
      profile[key] = [...new Set(prof[key])];
    }
  }
  const log = x.clientLog ? clientSnapshot(x.clientLog) : undefined;
  const placements = {};
  const validPlaces = new Set(
    mappedQuests(log).flatMap((q) => [
      q.id + "/turnin",
      ...q.objectives.map((o) => q.id + "/" + o.id),
    ]),
  );
  if (x.placements && !object(x.placements))
    fail("Invalid location assignments.");
  for (const [k, v] of Object.entries(x.placements || {})) {
    if (
      (!validPlaces.has(k) && !repo.get(k)?.navigationOnly) ||
      !repo.location(v)
    )
      fail("Unknown location assignment.");
    placements[k] = v;
  }
  const catalog = [
    ...repo.quests.filter((q) => !q.clientId),
    ...mappedQuests(log, placements),
  ];
  const byId = new Map(catalog.map((q) => [q.id, q]));
  if (
    !Array.isArray(x.selected) ||
    x.selected.length > 110 ||
    new Set(x.selected).size !== x.selected.length ||
    x.selected.some((id) => !byId.has(id))
  )
    fail("Unknown or duplicate quest selection.");
  const objIds = new Set(
    catalog.flatMap((q) => q.objectives.map((o) => q.id + "/" + o.id)),
  );
  if (
    !Array.isArray(x.omitted) ||
    x.omitted.length > 1600 ||
    x.omitted.some((id) => !objIds.has(id))
  )
    fail("Unknown objective selection.");
  if (
    !object(x.progress) ||
    !validText(x.timestamp, 40) ||
    !Number.isFinite(Date.parse(x.timestamp))
  )
    fail("Invalid progress or timestamp.");
  const progress = {};
  for (const [id, p] of Object.entries(x.progress)) {
    const q = byId.get(id);
    if (
      !q ||
      !object(p) ||
      typeof p.accepted !== "boolean" ||
      typeof p.turnedIn !== "boolean" ||
      !object(p.counts)
    )
      fail("Invalid quest progress.");
    const counts = {};
    for (const [key, n] of Object.entries(p.counts)) {
      const o = q.objectives.find((o) => o.id === key);
      if (!o || !integer(n, 0, o.count) || (!p.accepted && n))
        fail("Invalid objective count.");
      counts[key] = n;
    }
    if (
      p.turnedIn &&
      (!p.accepted || q.objectives.some((o) => counts[o.id] !== o.count))
    )
      fail("Turn-in requires completed objectives.");
    progress[id] = { accepted: p.accepted, turnedIn: p.turnedIn, counts };
  }
  for (const q of catalog)
    if (
      progress[q.id]?.accepted &&
      q.requires.some((id) => !progress[id]?.turnedIn)
    )
      fail("Quest progress violates a prerequisite.");
  return {
    schema: x.schema,
    graph: repo.version || VERSION,
    origin: "Imported snapshot",
    timestamp: x.timestamp,
    profile,
    progress,
    selected: x.selected,
    omitted: x.omitted,
    placements,
    ...(log ? { clientLog: log } : {}),
  };
}
export class LocalJournalStore {
  constructor(storage, key = "wayfarer-journal-v1") {
    this.key = key;
    this.storage = storage;
  }
  save(state) {
    try {
      this.storage?.setItem(this.key, JSON.stringify(state));
    } catch {}
  }
  load(repo) {
    try {
      const raw = this.storage?.getItem(this.key);
      if (raw) {
        const s = previewImport(raw, repo);
        s.origin = JSON.parse(raw).origin;
        if (
          ![
            "Sample",
            "Imported snapshot",
            "Manually edited",
            "Simulation",
          ].includes(s.origin)
        )
          s.origin = "Imported snapshot";
        return s;
      }
    } catch {}
    return (repo.makeSample || sample)();
  }
  clear() {
    this.storage?.removeItem(this.key);
  }
}
