import { esc } from "./view-utils.mjs";
export function indexZones(quests) {
  const zones = new Map();
  for (const q of quests) {
    if (!q.record) continue;
    for (const [kind, e] of [
      ["Pickup", q.record.accept],
      ["Turn-in", q.record.turnIn],
    ]) {
      if (!e?.mapId || !Number.isFinite(e.x) || !Number.isFinite(e.y)) continue;
      if (!zones.has(e.mapId))
        zones.set(e.mapId, {
          id: e.mapId,
          name: e.zone || "Map " + e.mapId,
          entries: [],
        });
      zones.get(e.mapId).entries.push({ q, kind, e });
    }
  }
  return [...zones.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function showZoneAtlas(zones, activeZone, modal, onQuest) {
  const $ = (id) => document.getElementById(id);
  modal(
    "Zone atlas",
    '<label>Zone map<select id="zoneChoice">' +
      zones
        .map(
          (z) =>
            '<option value="' +
            z.id +
            '">' +
            esc(z.name) +
            " · " +
            z.id +
            "</option>",
        )
        .join("") +
      '</select></label><label>Quest or NPC<input id="zoneSearch" type="search" placeholder="Search this zone"></label><div class="zoneAtlas"><svg id="zoneChart" viewBox="0 0 110 110" role="group" aria-label="Quest locations in zone coordinates"></svg></div><p id="pointSummary"></p><div id="pointList" class="pointList"></div><p><a href="https://foreverdb.net" target="_blank" rel="noopener">Data from ForeverDB.net</a></p>',
  );
  const initial =
    zones.find((z) => z.name === activeZone) ||
    zones.find((z) => z.name === "Duskwood") ||
    zones[0];
  $("zoneChoice").value = initial.id;
  function render() {
    const z = zones.find((z) => String(z.id) === $("zoneChoice").value);
    const query = $("zoneSearch").value.toLowerCase().trim();
    const entries = z.entries.filter(({ q, e }) =>
      (q.title + " " + (e.name || "") + " " + q.gameId)
        .toLowerCase()
        .includes(query),
    );
    const groups = new Map();
    entries.forEach((row) => {
      const k = row.e.x + "," + row.e.y;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(row);
    });
    const points = [...groups.values()];
    const grid = [0, 25, 50, 75, 100]
      .map(
        (v) =>
          '<path d="M' +
          (v + 5) +
          " 5v100M5 " +
          (v + 5) +
          'h100" fill="none" stroke="#8a916c" stroke-width=".25"/>',
      )
      .join("");
    $("zoneChart").innerHTML =
      grid +
      points
        .map((rows, i) => {
          const { e, kind } = rows[0],
            x = e.x + 5,
            y = e.y + 5;
          return (
            '<g data-pin="' +
            i +
            '" role="button" tabindex="0" aria-label="' +
            esc(e.name || kind) +
            " at " +
            e.x +
            ", " +
            e.y +
            '"><title>' +
            esc(e.name || kind) +
            " · " +
            rows.length +
            ' entries</title><circle r="2.2" cx="' +
            x +
            '" cy="' +
            y +
            '" fill="transparent"/>' +
            (kind === "Pickup"
              ? '<circle r="1.15" cx="' +
                x +
                '" cy="' +
                y +
                '" fill="#ffcf75" stroke="#3d311d" stroke-width=".3"/>'
              : '<path d="M' +
                x +
                " " +
                (y - 1.5) +
                'l1.4 1.5-1.4 1.5-1.4-1.5z" fill="#9edbb2" stroke="#1a342a" stroke-width=".3"/>') +
            "</g>"
          );
        })
        .join("");
    const list = (rows) => {
      $("pointList").innerHTML =
        rows
          .map(
            ({ q, e, kind }) =>
              '<button data-entry="' +
              q.id +
              '"><strong>' +
              esc(q.title) +
              "</strong><small>" +
              kind +
              " · " +
              esc(e.name || "Unknown endpoint") +
              " · " +
              e.x +
              ", " +
              e.y +
              "</small></button>",
          )
          .join("") || "<p>No matching locations.</p>";
    };
    $("pointSummary").textContent =
      points.length +
      " coordinates · " +
      entries.length +
      " quest endpoints. Gold circles show pickups and green diamonds show turn-ins. Select a pin to list its quests.";
    list(entries);
    function pick(ev) {
      const pin = ev.target.closest("[data-pin]");
      if (pin) {
        list(points[Number(pin.dataset.pin)]);
        $("pointList").scrollTop = 0;
      }
    }
    $("zoneChart").onclick = pick;
    $("zoneChart").onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick(e);
      }
    };
  }
  $("pointList").onclick = (e) => {
    const item = e.target.closest("[data-entry]");
    if (item) onQuest(item.dataset.entry);
  };
  $("zoneChoice").onchange = render;
  $("zoneSearch").oninput = render;
  render();
}
