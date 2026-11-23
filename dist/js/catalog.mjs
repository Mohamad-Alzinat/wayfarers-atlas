export const VERSION = "westreach-1";
export const provenance = {
  source: "Original teaching fixture",
  sourceVersion: VERSION,
  lastReviewed: "2026-11-21",
  confidence: "estimated",
  compatibleGameBuild: null,
};
export const zones = {
  Mistwood: { x: 0, y: 340, w: 720, h: 460 },
  "Crown Highlands": { x: 0, y: 0, w: 1000, h: 520 },
  Eastmarch: { x: 560, y: 220, w: 440, h: 580 },
};
const towns = [
  ["haven", "Wayfarer's Rest", "Mistwood", 0.64, 0.13, "inn"],
  ["wood", "Briarwood Grove", "Mistwood", 0.8, 0.004, "grove"],
  ["port", "Mistwater Harbor", "Mistwood", 0.345, 0.51, "harbor"],
  ["spire", "Highwatch Spire", "Crown Highlands", 0.33, 0.36, "tower"],
  ["pass", "Northwind Pass", "Crown Highlands", 0.72, 0.28, "pass"],
  ["mill", "Alderwick Mill", "Eastmarch", 0.048, 0.605, "mill"],
  ["ruin", "Moonfall Ruins", "Eastmarch", 0.6, 0.34, "ruins"],
  ["ford", "Silverbrook Ford", "Mistwood", 0.616, 0.39, "ford"],
  ["isle", "Warden's Isle", "Crown Highlands", 0.064, 0.57, "island"],
];
export function worldPoint(zone, u, v) {
  const z = zones[zone];
  return [z.x + u * z.w, z.y + v * z.h];
}
export const places = towns.map(([id, name, zone, u, v, kind]) => ({
  id,
  name,
  zone,
  u,
  v,
  kind,
  point: worldPoint(zone, u, v),
  ...provenance,
}));
export const placeById = Object.fromEntries(places.map((p) => [p.id, p]));
// Costs are scenario seconds. Intermediate points describe the fictional road, in atlas units.
const roads = [
  [
    "haven",
    "wood",
    88,
    [
      [487, 397],
      [519, 380],
      [545, 371],
    ],
  ],
  [
    "wood",
    "mill",
    94,
    [
      [611, 374],
      [629, 421],
      [575, 463],
      [531, 512],
    ],
  ],
  [
    "haven",
    "port",
    100,
    [
      [397, 425],
      [325, 440],
      [250, 468],
      [276, 515],
    ],
  ],
  [
    "port",
    "ford",
    107,
    [
      [299, 536],
      [347, 523],
      [395, 517],
    ],
  ],
  [
    "wood",
    "ford",
    66,
    [
      [549, 369],
      [507, 394],
      [476, 443],
      [448, 474],
    ],
  ],
  [
    "ford",
    "spire",
    92,
    [
      [416, 487],
      [384, 446],
      [339, 413],
      [351, 379],
      [411, 350],
      [461, 294],
      [440, 264],
      [385, 232],
    ],
  ],
  [
    "spire",
    "pass",
    118,
    [
      [395, 212],
      [470, 201],
      [532, 178],
      [637, 182],
    ],
  ],
  [
    "pass",
    "mill",
    139,
    [
      [756, 217],
      [785, 311],
      [743, 390],
      [707, 478],
      [646, 541],
    ],
  ],
  [
    "mill",
    "ruin",
    102,
    [
      [640, 551],
      [705, 529],
      [779, 510],
      [791, 460],
    ],
  ],
  [
    "wood",
    "ruin",
    155,
    [
      [612, 324],
      [652, 319],
      [705, 347],
      [741, 358],
      [774, 396],
    ],
  ],
];
const links = [
  [
    "port",
    "isle",
    "boat",
    68,
    [
      [179, 605],
      [105, 592],
      [43, 533],
      [32, 421],
    ],
    {},
  ],
  [
    "spire",
    "mill",
    "fly",
    53,
    [
      [401, 286],
      [504, 431],
    ],
    {},
  ],
  [
    "haven",
    "pass",
    "zeppelin",
    70,
    [
      [542, 304],
      [633, 235],
    ],
    { faction: "Horde", oneWay: true },
  ],
  [
    "port",
    "spire",
    "tram",
    47,
    [
      [286, 409],
      [363, 302],
    ],
    { faction: "Alliance" },
  ],
  ["ruin", "spire", "portal", 8, [], { class: "Mage", oneWay: true }],
];
export const edges = [
  ...roads.map(([a, b, c, via]) => [a, b, "walk", c, via, {}]),
  ...links,
].flatMap(([from, to, mode, seconds, via, gate]) => {
  const path = [placeById[from].point, ...via, placeById[to].point];
  const edge = { from, to, mode, seconds, path, ...gate, ...provenance };
  return gate.oneWay
    ? [edge]
    : [edge, { ...edge, from: to, to: from, path: [...path].reverse() }];
});
const quest = (
  id,
  title,
  level,
  giver,
  turnin,
  objective,
  site,
  count,
  unit,
  work,
  extra = {},
) => ({
  id,
  title,
  level,
  giver,
  turnin,
  zone: placeById[site].zone,
  requires: [],
  reward: null,
  objectives: [
    {
      id: "fieldwork",
      label: objective,
      place: site,
      count,
      unit,
      seconds: work,
    },
  ],
  ...provenance,
  ...extra,
});
export const quests = [
  quest(
    "W01",
    "Whispers in the Wood",
    12,
    "haven",
    "haven",
    "Gather whisperleaf",
    "wood",
    4,
    "sprigs",
    8,
    { icon: "leaf", reward: "Herbalist’s satchel" },
  ),
  quest(
    "W02",
    "The Watcher's Beacon",
    14,
    "haven",
    "spire",
    "Rekindle the beacon",
    "spire",
    1,
    "beacon",
    18,
    { icon: "flame" },
  ),
  quest(
    "W03",
    "Lost at the Crossing",
    12,
    "haven",
    "port",
    "Recover the sealed letters",
    "ford",
    3,
    "letters",
    9,
    { icon: "scroll" },
  ),
  quest(
    "W04",
    "A Miller's Due",
    13,
    "mill",
    "mill",
    "Inspect the millstones",
    "mill",
    2,
    "stones",
    10,
    { icon: "wheat" },
  ),
  quest(
    "W05",
    "Echoes of Moonfall",
    16,
    "spire",
    "haven",
    "Copy the moon runes",
    "ruin",
    3,
    "runes",
    12,
    { icon: "moon", requires: ["W02"] },
  ),
  quest(
    "W06",
    "The Last Ferryman",
    15,
    "port",
    "port",
    "Deliver the ship's ledger",
    "isle",
    1,
    "ledger",
    20,
    { icon: "anchor" },
  ),
  quest(
    "W07",
    "Along the High Road",
    16,
    "spire",
    "pass",
    "Mark the high pass",
    "pass",
    2,
    "cairns",
    9,
    { icon: "mountain" },
  ),
  quest(
    "W08",
    "The Warden's Oath",
    17,
    "isle",
    "spire",
    "Meet the island warden",
    "isle",
    1,
    "oath",
    15,
    { icon: "shield", requires: ["W06"] },
  ),
  quest(
    "W09",
    "A Silver Thread",
    11,
    "haven",
    "wood",
    "Gather silver reeds",
    "ford",
    4,
    "reeds",
    7,
    { icon: "leaf" },
  ),
  quest(
    "W10",
    "Embers for Eastmarch",
    14,
    "mill",
    "ruin",
    "Collect glowing embers",
    "wood",
    2,
    "embers",
    8,
    {
      icon: "flame",
      objectives: [
        {
          id: "embers",
          label: "Collect glowing embers",
          place: "wood",
          count: 2,
          unit: "embers",
          seconds: 8,
        },
        {
          id: "lantern",
          label: "Light the east lantern",
          place: "ruin",
          count: 1,
          unit: "lantern",
          seconds: 10,
        },
      ],
    },
  ),
];
export class CatalogRepository {
  constructor(records = quests, locations = places, connections = edges) {
    this.quests = records;
    this.places = locations;
    this.edges = connections;
  }
  get(id) {
    return this.quests.find((q) => q.id === id);
  }
  location(id) {
    return this.places.find((p) => p.id === id);
  }
}
export const defaultProfile = {
  name: "Elara Windborne",
  faction: "Alliance",
  class: "Hunter",
  start: "haven",
  mount: false,
  hearth: "haven",
  hearthReady: false,
  fly: true,
  boat: true,
  zeppelin: true,
  tram: true,
  portal: false,
  teleport: false,
  device: false,
};
export function sample() {
  return {
    schema: "wayfarer.journal/1",
    graph: VERSION,
    timestamp: new Date().toISOString(),
    origin: "Sample",
    profile: { ...defaultProfile },
    selected: ["W01", "W02", "W03"],
    omitted: [],
    progress: {
      W01: { accepted: true, turnedIn: false, counts: { fieldwork: 1 } },
      W02: { accepted: true, turnedIn: false, counts: { fieldwork: 0 } },
      W03: { accepted: true, turnedIn: false, counts: { fieldwork: 0 } },
    },
  };
}
export const graph = { version: VERSION, places, edges };
