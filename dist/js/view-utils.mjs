export const $ = (id) => document.getElementById(id);
export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const icon = (name) =>
  `<svg aria-hidden="true" class="icon"><use href="assets/icons.svg#${esc(name)}"/></svg>`;
export const clock = (seconds) => {
  const n = Math.max(0, Math.round(seconds || 0));
  return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
};
export const duration = (n) =>
  n >= 60
    ? Math.floor(n / 60) + "m " + (Math.round(n) % 60) + "s"
    : Math.round(n) + "s";
export const strategies = {
  atlas: "Atlas heuristic",
  exact: "Held–Karp exact",
  nearest: "Nearest neighbor",
};
export const modes = {
  walk: ["Walk", "footprints", "7 4", "#ffe19a"],
  ride: ["Mount", "mounted", "12 3 2 3", "#db9a59"],
  skyship: ["Skyship", "airship", "9 3 2 3", "#705783"],
  visit: ["Waypoint", "flag", "", null],
  fly: ["Flight", "bird", "2 6", "#497c8c"],
  boat: ["Boat", "sailboat", "12 5", "#418389"],
  zeppelin: ["Zeppelin", "airship", "12 3 3 3", "#806390"],
  tram: ["Tram", "train-front", "4 2", "#63483c"],
  portal: ["Portal", "sparkles", "1 4", "#824f9b"],
  teleport: ["Teleport", "sparkles", "1 6", "#825ea8"],
  hearth: ["Hearthstone", "flame", "2 5", "#996b9b"],
  device: ["Teleport device", "sparkles", "3 6", "#735b92"],
  accept: ["Accept", "scroll", "", null],
  objective: ["Objective", "flag", "", null],
  turnin: ["Turn in", "check", "", null],
};
