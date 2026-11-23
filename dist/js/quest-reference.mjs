import { esc } from "./view-utils.mjs";
const endpoint = (e) =>
  e
    ? [
        e.name,
        e.zone,
        Number.isFinite(e.x) && Number.isFinite(e.y) ? e.x + ", " + e.y : null,
        e.source,
      ]
        .filter(Boolean)
        .map(esc)
        .join(" · ")
    : "Unrecorded";
export function referenceCard(q) {
  const r = q.record;
  if (!r) return "";
  const plotted = [
    ["A", r.accept],
    ["T", r.turnIn],
  ].filter(
    ([, e]) => Number.isFinite(e?.x) && Number.isFinite(e?.y) && e.mapId,
  );
  const maps = [...new Set(plotted.map(([, e]) => e.mapId))]
    .map((id) => {
      const entries = plotted.filter(([, e]) => e.mapId === id);
      return (
        '<figure class="zonePlot"><svg viewBox="0 0 100 100" role="img" aria-label="' +
        esc(entries[0][1].zone) +
        ' zone coordinate grid"><path d="M25 0v100m25-100v100m25-100v100M0 25h100M0 50h100M0 75h100" fill="none" stroke="#657262" stroke-width=".5"/>' +
        entries
          .map(
            ([key, e]) =>
              '<circle cx="' +
              e.x +
              '" cy="' +
              e.y +
              '" r="' +
              (key === "A" ? 4 : 2) +
              '" fill="' +
              (key === "A" ? "#e7bd6b" : "#7ed0b1") +
              '"/>',
          )
          .join("") +
        "</svg><figcaption>" +
        esc(entries[0][1].zone) +
        " · zone grid " +
        id +
        "<br>Gold pickup · green turn-in</figcaption></figure>"
      );
    })
    .join("");
  return (
    '<section class="questReference"><small>Quest ' +
    r.id +
    " · " +
    esc(r.confidence) +
    " source · " +
    esc(r.side || "Faction unknown") +
    "</small><p><b>Pickup</b><br>" +
    endpoint(r.accept) +
    "</p><p><b>Turn-in</b><br>" +
    endpoint(r.turnIn) +
    "</p>" +
    maps +
    (r.objectiveFacts.length
      ? "<details><summary>Recorded objective facts (" +
        r.objectiveFacts.length +
        ")</summary><ul>" +
        r.objectiveFacts
          .map(
            (o) =>
              "<li>" +
              esc(
                Object.entries(o)
                  .map(
                    ([k, v]) =>
                      k + " " + (typeof v === "object" ? JSON.stringify(v) : v),
                  )
                  .join(" · "),
              ) +
              "</li>",
          )
          .join("") +
        "</ul></details>"
      : "") +
    (r.prerequisites.length
      ? "<p>Chain links · " +
        r.prerequisites.map((x) => esc(x.relation) + " #" + x.id).join(", ") +
        "</p>"
      : "") +
    (q.previous
      ? "<p>Scenario assumes a completed prerequisite · " +
        esc(q.previous) +
        "</p>"
      : "") +
    '<p><a href="' +
    esc(r.sourceUrl) +
    '" target="_blank" rel="noopener">Source record ↗</a> · <a href="https://foreverdb.net" target="_blank" rel="noopener">Data from ForeverDB.net</a></p></section>'
  );
}
