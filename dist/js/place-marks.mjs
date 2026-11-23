// Small conventional atlas marks. They identify the type of place; quest badges
// and illustrated capitals use their own layers of detail at the same map scale.
const marks = {
  bridge:
    '<path fill="#c6b897" d="M-8 0q8-5 16 0v4l-3-1v-1Q0-2-5 2v1l-3 1Z"/><path d="M-7-2v3m3-4v2m8-2v2m3-1v3M-6 5q3 1 6 0t6 0"/>',
  chapel:
    '<path fill="#cab998" d="M-6 5V-1l3-3 4 3v6Zm6 0v-8l3-3 3 3v8Z"/><path fill="#827c69" d="m-7-1 4-4 5 4Zm6-2 4-5 4 5Z"/><path d="M3-8v-2m-1 1h2m-7 13v-3m6-2v2"/>',
  farm: '<path fill="#c7b28a" d="M-7 3V-2l3-3 4 3v5Z"/><path fill="#9a7862" d="m-8-2 4-4 5 4Z"/><path d="m2-3 5 2m-6 1 6 2M0 2l6 2m-12-4v2"/>',
  village:
    '<path fill="#c7b28a" d="M-7 4V-1l3-3 4 3v5Zm7 0V-3l3-4 4 4v7Z"/><path fill="#8b7760" d="m-8-1 4-4 5 4Zm7-2 4-5 5 5Z"/><path d="M-4 4V1m7 3V0"/>',
  camp: '<path fill="#c8ae82" d="m-7 4 5-9 6 9Zm10 0 3-6 4 6Z"/><path d="m-3 4 1-5 3 5M-3-6l2 2m1-2-2 2"/>',
  fort: '<path fill="#c0b091" d="M-6 4V-5h2v2h2v-2h2v9Zm6 0v-6h4v-3h2v9Z"/><path d="M-4 0v2m6 2V1"/>',
  terrain:
    '<path fill="#b8b091" d="m-8 4 6-8 3 4 2-4 5 8Z"/><path d="m-3-1 1-3 2 5m2-2 1-3"/>',
  ruin: '<path fill="#b6ac92" d="M-6 4v-8l3 1v3l2-2 1 6Zm7 0v-5l2-3 2 1v7Z"/><path d="M-7 5h14"/>',
  dock: '<path fill="#bfa986" d="M-7 2h13l-3 3h-7Z"/><path fill="#d7cbae" d="M-1 0v-7l5 7Z"/><path d="M-7 6q3 2 6 0t7 0"/>',
};
const types = {
  bridge: ["thandol"],
  chapel: ["lightshope"],
  farm: ["hillsbradfields", "northfold"],
  camp: ["chillwind", "nesingwary", "taurajo", "mojache", "gromgol"],
  fort: [
    "stromgarde",
    "nethergarde",
    "feathermoon",
    "farholde",
    "cenarionhold",
    "splintertree",
    "freewind",
  ],
  terrain: [
    "alterac",
    "raptorgrounds",
    "arathiraptors",
    "lashtail",
    "summit",
    "taintedfoothills",
    "skywatcher",
    "badlands",
    "forgottencoast",
    "flamecrest",
  ],
  ruin: ["uldaman", "mathystra", "ironbandsdig", "tranquilgardens", "dunmodr"],
  dock: [
    "menethil",
    "bootybay",
    "auberdine",
    "ratchet",
    "theramore",
    "steamwheedle",
    "powderfuse",
    "shadowprey",
  ],
};
const byId = new Map(
  Object.entries(types).flatMap(([type, ids]) => ids.map((id) => [id, type])),
);
export const placeMark = (id) => marks[byId.get(id) || "village"];
