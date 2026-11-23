import { sample as practice } from "./catalog.mjs";
export const GAME_VERSION = "azeroth-v1";
const work = {
  nightwatch: [
    ["Skeletal Warriors", 8],
    ["Skeletal Mages", 6],
  ],
  northfold: [
    ["Syndicate Highwaymen", 10],
    ["Syndicate Mercenaries", 6],
  ],
  nobledeaths: [["Alterac Signet Rings", 7]],
  raisingspirits: [["Highland Raptor Eyes", 10]],
  hillsbrad: [["Hillsbrad Peasants", 15]],
  gromgol: [["Lashtail Raptors", 15]],
};
export function gameCatalog(world, catalog) {
  const byId = new Map(catalog.quests.map((row) => [row.id, row]));
  const loc = new Map(world.places.map((p) => [p.id, p]));
  const used = new Set(),
    quests = [];
  for (const [side, rows] of Object.entries(world.quests)) {
    const faction = side === "alliance" ? "Alliance" : "Horde";
    for (const row of rows) {
      const record =
        byId.get(row.questId) ||
        catalog.quests.find(
          (q) =>
            q.title.toLowerCase() === row.name.toLowerCase() &&
            (!q.side || q.side === "Both" || q.side === faction),
        );
      if (record) used.add(record.id);
      const objectives = (row.objectives || []).flatMap((place, i) => {
        const tasks = work[row.id] || [
          ["Complete fieldwork at " + loc.get(place).name, 1],
        ];
        const count = tasks.reduce((n, t) => n + t[1], 0);
        return tasks.map(([label, n], j) => ({
          id: "work-" + i + "-" + j,
          label,
          place,
          count: n,
          unit: label,
          seconds: row.work / count,
        }));
      });
      quests.push({
        id: side + "-" + row.id,
        gameId: record?.id,
        title: row.name,
        level: row.level,
        zone: loc.get(row.giver).zone,
        icon: "scroll",
        faction,
        giver: row.giver,
        turnin: row.turnin,
        objectives,
        requires: (row.requires || []).map((id) => side + "-" + id),
        previous: row.previous,
        record,
        source:
          "Repository Classic quest model · estimated travel and activity",
      });
    }
  }
  for (const record of catalog.quests) {
    if (used.has(record.id)) continue;
    const zone = record.accept?.zone || record.zone;
    const candidates = world.places.filter((p) => p.zone === zone);
    const hub = candidates.length === 1 ? candidates[0].id : null;
    quests.push({
      id: "ref-" + record.id,
      gameId: record.id,
      title: record.title,
      level: record.level,
      zone: zone || "Unknown zone",
      giver: hub,
      turnin: hub,
      defaultHub: hub,
      faction: ["Alliance", "Horde"].includes(record.side) ? record.side : null,
      requires: [],
      objectives: [],
      record,
      navigationOnly: true,
      icon: "flag",
      source: record.confidence,
    });
  }
  const edges = world.edges.map((e) => ({
    ...e,
    path: [loc.get(e.from).point, loc.get(e.to).point],
  }));
  return {
    quests,
    places: world.places,
    edges,
    masters: world.masters,
    spells: world.spells,
    zones: Object.fromEntries(
      [...new Set(quests.map((q) => q.zone))].sort().map((z) => [z, true]),
    ),
  };
}
export function gameSample() {
  const s = practice();
  return {
    ...s,
    graph: GAME_VERSION,
    selected: ["alliance-jameshyal", "alliance-nightwatch"],
    progress: {},
    profile: {
      ...s.profile,
      travelPreset: "full",
      start: "menethil",
      hearth: "menethil",
      portal: true,
      skyship: true,
      transporter: false,
      ripper: false,
    },
  };
}
export async function loadAzeroth() {
  const data = await Promise.all(
    ["azeroth", "quests"].map(async (name) => {
      const res = await fetch("data/" + name + ".json");
      if (!res.ok) throw Error("Could not load " + name);
      return res.json();
    }),
  );
  return gameCatalog(...data);
}
