import { $, icon, esc, modes } from "./view-utils.mjs";
import { placeMark } from "./place-marks.mjs";
import { cityArtwork } from "./city-glyphs.mjs";

const overlaps = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// These names are engraved in the original basemap, in its 1000 × 800 plane.
const engravedNames = [
  { left: 687, right: 926, top: 8, bottom: 30 },
  { left: 199, right: 363, top: 752, bottom: 780 },
  { left: 52, right: 124, top: 98, bottom: 115 },
  { left: 457, right: 533, top: 82, bottom: 100 },
  { left: 476, right: 505, top: 304, bottom: 455 },
];

// Prioritize regional hubs at world scale. The available screen area determines
// the number of local captions; each zoom level makes room for additional names.
const hubs = new Set([
  "menethil",
  "bootybay",
  "auberdine",
  "ratchet",
  "theramore",
  "darkshire",
  "tarrenmill",
  "southshore",
  "lakeshire",
  "crossroads",
  "gadgetzan",
  "hammerfall",
  "everlook",
  "nighthaven",
  "thelsamar",
  "shadowprey",
  "sentinelhill",
]);
function positionLabels(rows, game, scale, unit, measure) {
  const taken = game ? [...engravedNames] : [];
  for (const { p, city, quest, status } of rows) {
    const [x, y] = p.point;
    const r = city
      ? 26 * scale
      : quest || status !== "other" || !game
        ? 14
        : 5.5 * scale;
    taken.push({
      owner: p.id,
      minor: !city && !quest && status === "other",
      left: x - r,
      right: x + r,
      top: y - r,
      bottom: y + r,
    });
  }
  const result = new Map();
  const priority = (r) =>
    r.city
      ? 0
      : r.status === "current"
        ? 1
        : r.order >= 0
          ? 2
          : hubs.has(r.p.id)
            ? 3
            : 4;
  const edgeRoom = ({
    p: {
      point: [x, y],
    },
  }) => Math.min(x, 1000 - x, y, 800 - y);
  const ranked = rows
    .filter((r) => r.showName)
    .sort(
      (a, b) =>
        priority(a) - priority(b) ||
        (a.city && b.city ? edgeRoom(a) - edgeRoom(b) : 0),
    );
  const named = ranked.filter((r) => priority(r) < 3);
  // Distribute local names across the continents before filling dense corridors.
  for (const rank of [3, 4]) {
    const remaining = ranked.filter((r) => priority(r) === rank);
    const anchors = named.map((r) => r.p.point);
    const spacing = (p) =>
      anchors.length
        ? Math.min(
            ...anchors.map(([x, y]) => (p[0] - x) ** 2 + (p[1] - y) ** 2),
          )
        : 0;
    const candidates = remaining.map((r) => ({
      row: r,
      gap: spacing(r.p.point),
    }));
    while (candidates.length) {
      const best = candidates.reduce((winner, next) =>
        winner.gap >= next.gap ? winner : next,
      );
      candidates.splice(candidates.indexOf(best), 1);
      named.push(best.row);
      const [x, y] = best.row.p.point;
      for (const c of candidates)
        c.gap = Math.min(
          c.gap,
          (c.row.p.point[0] - x) ** 2 + (c.row.p.point[1] - y) ** 2,
        );
    }
  }
  let localCount = 0;
  const localBudget = Math.max(
    8,
    Math.round((1000 * 800 * unit * unit) / 9000),
  );
  for (const { p, city, order, status } of named) {
    const local = game && !city && order < 0 && status !== "current";
    const [x, y] = p.point;
    if (local && localCount >= localBudget) continue;
    const labelScale = game
      ? local
        ? Math.max(scale, 0.72 / unit)
        : scale
      : 1;
    const size = city ? 19 : local ? 13 : game ? 16 : 18;
    const width =
      measure(city ? p.name.toUpperCase() : p.name, size, local) *
        (local ? 1.07 : 1.04) *
        labelScale +
      (city ? p.name.length * 0.5 * labelScale : 0);
    const h = size * 1.2 * labelScale;
    const padding = city ? 26 * scale : local ? 8 * scale : 18 * labelScale;
    const side = width / 2 + padding;
    // Prefer captions close to their landmark; use a leader for displaced captions.
    const candidates = [
      [0, padding + h / 2],
      [0, -padding - h / 2],
      [side, 0],
      [-side, 0],
      [side, padding],
      [-side, padding],
      [side, -padding],
      [-side, -padding],
      [side * 0.5, padding + h / 2],
      [-side * 0.5, padding + h / 2],
      [side * 0.5, -padding - h / 2],
      [-side * 0.5, -padding - h / 2],
    ];
    // Dense quest hubs may need a caption in an adjacent clearing.
    for (const distance of local ? [1.1, 1.7] : [1.5, 2.1, 2.8, 3.6, 4.4]) {
      for (const horizontal of [0, -0.55, 0.55, -1, 1]) {
        for (const vertical of [-1, 1])
          candidates.push([
            side * horizontal,
            vertical * (padding + h * distance),
          ]);
      }
    }
    function* labelPositions() {
      yield* candidates;
      if (!city) return;
      // On a small canvas two nearby capitals can exhaust the eight compass
      // positions. Search nearby clearings in increasing distance order.
      for (let radius = 24; radius <= 220; radius += 8) {
        for (let sector = 0; sector < 24; sector++) {
          const angle = (sector * Math.PI) / 12;
          const dx = radius * Math.cos(angle),
            dy = radius * Math.sin(angle);
          if (Math.abs(dx) > side || Math.abs(dy) > padding + h / 2)
            yield [dx, dy];
        }
      }
    }
    for (const [dx, dy] of labelPositions()) {
      const cx = Math.max(width / 2 + 5, Math.min(995 - width / 2, x + dx));
      const cy = y + dy;
      const gutter = Math.max(3, 2.5 / unit);
      const box = {
        left: cx - width / 2 - gutter,
        right: cx + width / 2 + gutter,
        top: cy - h / 2 - gutter,
        bottom: cy + h / 2 + gutter,
      };
      if (
        box.top < 3 ||
        box.bottom > 797 ||
        taken.some(
          (other) =>
            other.owner !== p.id &&
            !(city && other.minor) &&
            overlaps(box, other),
        )
      )
        continue;
      taken.push(box);
      if (local) localCount++;
      const tx = cx - x,
        ty = cy - y;
      const leader =
        Math.abs(ty) > padding + h || Math.abs(tx) > width / 2 + padding - 2
          ? `<path class="labelLeader" d="M0 0L${tx - Math.sign(tx) * Math.min(Math.abs(tx), width / 2)} ${ty - Math.sign(ty) * Math.min(Math.abs(ty), h / 2)}"/>`
          : "";
      result.set(p.id, {
        leader,
        text: `<text class="mapLabel${city ? " cityName" : local ? " localName" : game ? " stopName" : ""}" text-anchor="middle" dominant-baseline="central" transform="translate(${tx} ${ty}) scale(${labelScale})">${esc(p.name)}</text>`,
      });
      break;
    }
  }
  return result;
}

export class AtlasMap {
  constructor(repo, onLocation, onOverride) {
    this.repo = repo;
    this.onLocation = onLocation;
    this.override = onOverride;
    this.profile = {};
    this.zoom = 1;
    this.x = 0;
    this.y = 0;
    this.layers = {
      route: true,
      quests: true,
      graph: false,
      zones: false,
      labels: true,
    };
    this.svg = $("world");
    this.isWorld = this.repo.version === "azeroth-v1";
    this.fontMeasure = document.createElement("canvas").getContext("2d");
    this.svg.closest(".mapCanvas").classList.toggle("worldOcean", this.isWorld);
    if (this.isWorld) {
      // Use the basemap's own open-water pixels for pan margins and letterboxing.
      this.svg.insertAdjacentHTML(
        "afterbegin",
        `
        <defs>
          <pattern id="atlasOcean" width="216" height="216" patternUnits="userSpaceOnUse">
            <g id="seaPatch"><svg width="108" height="108" viewBox="428 173 108 108"><image href="assets/azeroth.webp" width="1000" height="800"/></svg></g>
            <use href="#seaPatch" transform="translate(216 0) scale(-1 1)"/>
            <use href="#seaPatch" transform="translate(0 216) scale(1 -1)"/>
            <use href="#seaPatch" transform="translate(216 216) scale(-1 -1)"/>
          </pattern>
          <linearGradient id="shoreFade"><stop stop-color="black"/><stop offset=".025" stop-color="white"/><stop offset=".975" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
          <linearGradient id="seaFade" x2="0" y2="1"><stop stop-opacity="1"/><stop offset=".023" stop-opacity="0"/><stop offset=".977" stop-opacity="0"/><stop offset="1" stop-opacity="1"/></linearGradient>
          <mask id="seaMargins"><rect width="1000" height="800" fill="url(#shoreFade)"/><rect width="1000" height="800" fill="url(#seaFade)"/></mask>
        </defs>
        <rect x="-8000" y="-8000" width="17000" height="17000" fill="url(#atlasOcean)" pointer-events="none"/>`,
      );
      $("camera")
        .querySelector("image")
        .setAttribute("mask", "url(#seaMargins)");
      new ResizeObserver(() => this.layoutMarkers()).observe(this.svg);
    }
    this.lastPose = null;
    this.lineIndex = -1;
    this.heading = 0;
    this.previousTime = 0;
    this.renderBase();
    const toMap = (e) => {
      const p = this.svg.createSVGPoint();
      p.x = e.clientX;
      p.y = e.clientY;
      return p.matrixTransform(this.svg.getScreenCTM().inverse());
    };
    let drag;
    this.svg.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".marker")) return;
      drag = toMap(e);
      this.svg.setPointerCapture(e.pointerId);
    });
    this.svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const p = toMap(e);
      this.x += p.x - drag.x;
      this.y += p.y - drag.y;
      drag = p;
      this.override();
      this.transform();
    });
    this.svg.addEventListener("pointerup", () => (drag = null));
    this.svg.addEventListener("pointercancel", () => (drag = null));
    this.svg.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.scale(e.deltaY < 0 ? 1.17 : 1 / 1.17, toMap(e));
      },
      { passive: false },
    );
    this.svg.addEventListener("click", (e) => {
      const g = e.target.closest(".marker");
      if (g) this.onLocation(g.dataset.id);
    });
    this.svg.addEventListener("keydown", (e) => {
      const g = e.target.closest(".marker");
      if (g && ["Enter", " "].includes(e.key)) {
        e.preventDefault();
        this.onLocation(g.dataset.id);
        return;
      }
      const delta = {
        ArrowLeft: [35, 0],
        ArrowRight: [-35, 0],
        ArrowUp: [0, 35],
        ArrowDown: [0, -35],
      }[e.key];
      if (delta) {
        e.preventDefault();
        this.override();
        this.x += delta[0];
        this.y += delta[1];
        this.transform();
      }
    });
    this.svg.setAttribute("tabindex", "0");
  }
  setProfile(profile) {
    this.profile = profile;
    this.renderBase();
  }
  renderBase() {
    $("graph").innerHTML = this.repo.edges
      .filter((e) => e.from < e.to || e.oneWay)
      .map((e) => {
        const allowed =
          (e.mode === "walk" || this.profile[e.mode]) &&
          (!e.class ||
            e.class.toUpperCase() === this.profile.class?.toUpperCase()) &&
          (!e.faction || e.faction === this.profile.faction) &&
          (e.mode !== "fly" ||
            !this.profile.knownFlights ||
            [e.from, e.to].every((id) =>
              this.profile.knownFlights.includes(id),
            ));
        return `<polyline points="${e.path.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${allowed ? "#534e35" : "#8a3131"}" stroke-width="${allowed ? 2.5 : 3.5}" stroke-dasharray="${allowed ? modes[e.mode][2] : "2 7"}"><title>${modes[e.mode][0]} · ${e.seconds} s · estimated · ${allowed ? "available" : "restricted by this profile"}</title></polyline>`;
      })
      .join("");
    $("boundaries").innerHTML =
      '<path d="M200 365Q395 430 550 350T990 300 M600 330Q665 510 585 800" fill="none" stroke="#5e573e" stroke-width="3" stroke-dasharray="4 4"/>';
    this.transform();
  }
  transform() {
    this.x = Math.min(240, Math.max(760 - 1000 * this.zoom, this.x));
    this.y = Math.min(195, Math.max(605 - 800 * this.zoom, this.y));
    $("zoomReadout").textContent = Math.round(this.zoom * 100) + "%";
    $("camera").setAttribute(
      "transform",
      `translate(${this.x} ${this.y}) scale(${this.zoom})`,
    );
    for (const [key, id] of Object.entries({
      route: "routeLines",
      zones: "boundaries",
      graph: "graph",
    }))
      $(id).style.display = this.layers[key] ? "" : "none";
    if (this.isWorld && this.lastLayoutZoom !== this.zoom) {
      this.lastLayoutZoom = this.zoom;
      this.layoutMarkers();
    }
  }
  scale(f, center = { x: 500, y: 400 }) {
    this.override();
    const z = Math.max(1, Math.min(4, this.zoom * f)),
      k = z / this.zoom;
    this.x = center.x - (center.x - this.x) * k;
    this.y = center.y - (center.y - this.y) * k;
    this.zoom = z;
    this.transform();
  }
  focus(point, zoom = this.zoom) {
    this.zoom = zoom;
    this.x = 500 - point[0] * zoom;
    this.y = 400 - point[1] * zoom;
    this.transform();
  }
  fit(route) {
    const pts =
      route?.legs?.flatMap(
        (l) =>
          l.path || [
            this.repo.location(l.from).point,
            this.repo.location(l.to).point,
          ],
      ) || [];
    if (!pts.length) {
      this.reset();
      return;
    }
    const x = pts.map((p) => p[0]),
      y = pts.map((p) => p[1]),
      l = Math.min(...x),
      t = Math.min(...y),
      r = Math.max(...x),
      b = Math.max(...y);
    this.focus(
      [(l + r) / 2, (t + b) / 2],
      Math.min(2.3, 800 / Math.max(1, r - l), 580 / Math.max(1, b - t)),
    );
  }
  reset() {
    this.x = this.y = 0;
    this.zoom = 1;
    this.transform();
  }
  route(result) {
    this.result = result?.status === "ok" ? result : null;
    this.lineIndex = -1;
    $("routeLines").innerHTML = (this.result?.legs || [])
      .map((l, i) => {
        if (l.kind !== "travel") return "";
        if (["hearth", "portal", "device", "teleport"].includes(l.mode)) {
          return (
            '<g data-leg="' +
            i +
            '"><title>' +
            modes[l.mode][0] +
            " · modeled cast " +
            l.seconds +
            " s</title>" +
            [l.from, l.to]
              .map((id) => {
                const p = this.repo.location(id).point;
                return (
                  '<circle class="ink" cx="' +
                  p[0] +
                  '" cy="' +
                  p[1] +
                  '" r="21" fill="none" stroke="#825ea8" stroke-width="4" stroke-dasharray="2 4"/>'
                );
              })
              .join("") +
            "</g>"
          );
        }
        const points = (
          l.path || [
            this.repo.location(l.from).point,
            this.repo.location(l.to).point,
          ]
        )
          .map((p) => p.join(","))
          .join(" ");
        const m = modes[l.mode];
        return `<g data-leg="${i}"><title>${esc(this.repo.location(l.from).name)} to ${esc(this.repo.location(l.to).name)} · ${m[0]} · ${Math.round(l.seconds)} s · estimated</title><polyline points="${points}" fill="none" stroke="#5b4429" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><polyline class="ink" points="${points}" fill="none" stroke="${m[3]}" stroke-width="4" stroke-dasharray="${m[2]}" stroke-linecap="round" stroke-linejoin="round"/><polyline class="coveredPart" pathLength="1" points="${points}" fill="none" stroke="#246852" stroke-width="6" stroke-linecap="butt" visibility="hidden"/></g>`;
      })
      .join("");
  }
  markers(selected, progress, state = this.state) {
    const legs = this.result?.legs || [],
      time = state?.time || 0;
    const reached = new Set([
      this.profile.start,
      ...legs.filter((l) => l.endsAt <= time).map((l) => l.to),
    ]);
    const current = state?.leg?.to;
    const routePlaces = new Set(legs.flatMap((l) => [l.from, l.to]));
    const stops = this.result?.stops || [];
    const activities = new Map();
    for (const id of selected) {
      const q = this.repo.get(id);
      if (!q || progress[id]?.turnedIn) continue;
      const add = (place, kind) => {
        if (!activities.has(place)) activities.set(place, new Set());
        activities.get(place).add(kind);
      };
      if (!progress[id]?.accepted) add(q.giver, "accept");
      for (const o of q.objectives) {
        if ((progress[id]?.counts?.[o.id] || 0) < o.count)
          add(o.place, "objective");
      }
      add(q.turnin, "turnin");
    }
    this.markerRows = this.repo.places.map((p) => {
      const city = this.isWorld ? cityArtwork(p.id) : null;
      const order = stops.findIndex((s) => s.place === p.id && s.endsAt > time);
      const kinds = activities.get(p.id);
      const quest = this.layers.quests && Boolean(kinds?.size);
      const status =
        current === p.id
          ? "current"
          : reached.has(p.id)
            ? "reached"
            : routePlaces.has(p.id)
              ? "upcoming"
              : "other";
      const kind = kinds?.has("objective")
        ? "objective"
        : kinds?.has("accept")
          ? "accept"
          : "turnin";
      const symbol =
        current === p.id && state?.leg?.kind === "travel"
          ? "➤"
          : reached.has(p.id) && order < 0
            ? "✓"
            : quest
              ? order >= 0
                ? String(order + 1)
                : kind === "turnin"
                  ? "?"
                  : "!"
              : reached.has(p.id)
                ? "✓"
                : "•";
      return {
        p,
        city,
        order,
        quest,
        kind,
        symbol,
        status,
        showName: this.layers.labels,
      };
    });
    this.layoutMarkers(true);
    this.transform();
  }
  layoutMarkers(force = false) {
    if (!this.markerRows || !this.svg.clientWidth || !this.svg.clientHeight)
      return;
    const unit =
      Math.min(this.svg.clientWidth / 1000, this.svg.clientHeight / 800) *
      this.zoom;
    const scale = this.isWorld
      ? Math.max(0.46, Math.min(1.65, 0.76 / unit))
      : 1;
    if (!force && Math.abs(unit - this.layoutUnit) < 0.01) return;
    this.layoutUnit = unit;
    this.labelScale = scale;
    const measure = (name, size, local) => {
      this.fontMeasure.font =
        (local ? "italic " : "bold ") + size + "px Georgia";
      return this.fontMeasure.measureText(name).width;
    };
    const labels = positionLabels(
      this.markerRows,
      this.isWorld,
      scale,
      unit,
      measure,
    );
    const focused =
      document.activeElement?.closest("#markers .marker")?.dataset.id;
    const paintRank = (r) =>
      r.city ? 2 : r.quest || r.status !== "other" ? 1 : 0;
    const paintOrder = [...this.markerRows].sort(
      (a, b) => paintRank(a) - paintRank(b),
    );
    $("markers").innerHTML = paintOrder
      .map(({ p, city, order, quest, kind, symbol, status }) => {
        const [x, y] = p.point;
        const minor = this.isWorld && !city && status === "other" && !quest;
        const title =
          esc(p.name) +
          (city ? " · " + esc(city.description) : "") +
          " · " +
          status +
          (order >= 0 ? " · next visit #" + (order + 1) : "");
        const label = labels.get(p.id);
        const badge = quest
          ? `<text x="12" y="-10" font-size="16" text-anchor="middle" fill="#f7df80" stroke="#352f20" stroke-width="2.5" paint-order="stroke">${{ objective: "◆", accept: "!", turnin: "?" }[kind]}</text>`
          : "";
        let marker;
        if (city) {
          const active = quest || status !== "other";
          const number = order >= 0 ? order + 1 : symbol;
          const stateBadge = active
            ? `<g class="cityBadge" transform="translate(17 -15)"><circle r="10"/><text y=".5" text-anchor="middle" dominant-baseline="central">${number}</text></g>`
            : "";
          marker = `<g transform="scale(${scale})"><circle class="cityTarget" r="26"/>${city.svg}${stateBadge}</g>`;
        } else if (minor) {
          marker = `<g transform="scale(${scale})"><circle class="placeTarget" r="11"/><g class="placeArt" aria-hidden="true">${placeMark(p.id)}</g></g>`;
        } else {
          marker = `<circle r="23" fill="transparent"/><path class="pin" d="M0 13L-4 7A12 12 0 1 1 4 7Z" fill="${quest ? "#3a412a" : "#574a32"}" stroke="${quest ? "#f5d788" : "#cfba85"}" stroke-width="2"/><text text-anchor="middle" y="1" fill="#ffdf91" font-family="Georgia" font-weight="bold" font-size="16">${symbol}</text>${badge}`;
        }
        return `<g class="marker ${status}${minor ? " minor" : ""}${city ? " city" : ""}" data-status="${status}" role="button" tabindex="0" data-id="${esc(p.id)}" transform="translate(${x} ${y})" aria-label="${esc(p.name)}, ${city ? "city landmark" : quest ? "quest location" : esc(p.kind)}"><title>${title}</title>${label?.leader || ""}${marker}${label?.text || (this.layers.labels ? `<text class="mapLabel localName revealName" text-anchor="middle" y="-12" transform="scale(${scale})">${esc(p.name)}</text>` : "")}</g>`;
      })
      .join("");
    if (focused)
      $("markers")
        .querySelector(`[data-id="${CSS.escape(focused)}"]`)
        ?.focus({ preventScroll: true });
  }
  frame(s, follow, reduced) {
    this.state = s;
    const mode = s.leg?.mode || "walk";
    const instant = ["hearth", "portal", "teleport", "device"].includes(mode);
    const p = reduced && s.leg ? this.repo.location(s.leg.from).point : s.point;
    const g = $("player");
    g.setAttribute("transform", `translate(${p[0]} ${p[1]})`);
    if (this.lastMode !== mode) {
      this.lastMode = mode;
      g.innerHTML = `<circle r="20" fill="#173a31" stroke="#e8d797" stroke-width="3"/><defs><clipPath id="avatarCrop"><circle r="17"/></clipPath></defs><image href="assets/ranger.webp" x="-17" y="-17" width="34" height="34" clip-path="url(#avatarCrop)"/><circle r="24" stroke="#294638" stroke-width="1.5" fill="none"/><g transform="translate(13 11)"><circle r="10" fill="#1e4034" stroke="#e8d797" stroke-width="1.5"/><svg x="-7" y="-7" viewBox="0 0 24 24" width="14" height="14" color="#f7e8c4"><use href="assets/icons.svg#${modes[mode]?.[1] || "navigation"}"/></svg></g><path class="heading" d="M31 0l-10 -5v10z" fill="#f8dc92" stroke="#344037"/>`;
    }
    g.setAttribute("class", s.playing && !reduced ? "moving mode-" + mode : "");
    const delta = ((s.angle - this.heading + 540) % 360) - 180;
    const dt = Math.max(0, s.time - this.previousTime);
    this.heading =
      s.playing && !reduced && dt < 3
        ? this.heading + delta * (1 - Math.exp(-dt * 1.5))
        : s.angle;
    this.previousTime = s.time;
    g.querySelector(".heading")?.setAttribute(
      "transform",
      `rotate(${this.heading})`,
    );
    if (!reduced && instant)
      g.setAttribute(
        "opacity",
        String(0.7 + 0.3 * Math.cos(s.fraction * 6.28)),
      );
    else g.removeAttribute("opacity");
    if (this.lineIndex !== s.i) {
      this.lineIndex = s.i;
      const lines = [...$("routeLines").children];
      for (const line of lines) {
        const i = Number(line.dataset.leg);
        const status = i < s.i ? "reached" : i === s.i ? "current" : "upcoming";
        line.setAttribute("data-status", status);
        line.setAttribute("opacity", status === "upcoming" ? ".72" : "1");
        const part = line.querySelector(".coveredPart");
        if (part)
          part.setAttribute(
            "visibility",
            status === "current" ? "visible" : "hidden",
          );
        for (const ink of line.querySelectorAll(".ink")) {
          ink.setAttribute(
            "stroke",
            status === "reached"
              ? "#246852"
              : status === "current"
                ? "#ffdc67"
                : "#4a4238",
          );
          ink.setAttribute("stroke-width", status === "current" ? "7" : "4.5");
          ink.setAttribute(
            "stroke-dasharray",
            status === "upcoming"
              ? "3 8"
              : status === "reached"
                ? "none"
                : modes[this.result.legs[i].mode][2] || "none",
          );
        }
      }
      lines
        .sort((a, b) => {
          const rank = { upcoming: 0, reached: 1, current: 2 };
          return rank[a.dataset.status] - rank[b.dataset.status];
        })
        .forEach((line) => $("routeLines").append(line));
    }
    if (this.partialIndex !== s.i || this.partialRoute !== this.result) {
      this.partialRoute = this.result;
      this.partialIndex = s.i;
      this.partialLine = $("routeLines").querySelector(
        '[data-leg="' + s.i + '"] .coveredPart',
      );
    }
    this.partialLine?.setAttribute("stroke-dasharray", s.fraction + " 1");
    if (follow && s.playing && !reduced)
      this.focus(p, mode === "fly" ? 1.12 : 1.45);
    this.lastPose = p;
  }
}
