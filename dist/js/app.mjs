import {
  CatalogRepository,
  quests as practiceQuests,
  places as practicePlaces,
  zones as practiceZones,
  sample as practiceSample,
} from "./catalog.mjs";
import {
  QuestPlannerFacade,
  EventBus,
  Commands,
  questStatus,
  progressOf,
} from "./domain.mjs";
import { WebLuaBridgeAdapter } from "./bridge.mjs";
import { JourneyPlaybackController } from "./playback.mjs";
import { AtlasMap } from "./map.mjs";
import {
  LocalJournalStore,
  previewImport,
  mappedQuests,
} from "./snapshots.mjs";
import {
  $,
  esc,
  icon,
  clock,
  duration,
  modes,
  strategies,
} from "./view-utils.mjs";
import { loadAzeroth, gameSample, GAME_VERSION } from "./azeroth.mjs";
import { indexZones, showZoneAtlas } from "./zone-atlas.mjs";
import { referenceCard } from "./quest-reference.mjs";
const game =
  new URLSearchParams(location.search).get("adventure") !== "westreach";
const data = game
  ? await loadAzeroth()
  : { quests: practiceQuests, places: practicePlaces, zones: practiceZones };
import {
  travelStyles,
  styleOf,
  projectedMethods,
  allowedQuest,
} from "./journal-style.mjs";
const factionIndexes = new Map();
const sourceQuestById = new Map(
  data.quests.filter((q) => q.gameId).map((q) => [q.gameId, q]),
);
const { quests, places, zones } = data,
  sample = game ? gameSample : practiceSample;
const waypoints = game
  ? places.map((p) => ({
      id: "waypoint-" + p.id,
      waypoint: true,
      navigationOnly: true,
      giver: p.id,
      turnin: p.id,
      zone: p.zone,
      title: p.name,
      icon: "flag",
      requires: [],
      objectives: [],
    }))
  : [];
const bus = new EventBus(),
  repo = new CatalogRepository([...quests, ...waypoints], places, data.edges),
  router = new WebLuaBridgeAdapter();
if (game)
  Object.assign(repo, {
    version: GAME_VERSION,
    makeSample: sample,
    masters: data.masters,
    spells: data.spells,
  });
let pageSize = 40;
let storage;
try {
  storage = localStorage;
} catch {}
const store = new LocalJournalStore(
    storage,
    game ? "wayfarer-azeroth-v1" : undefined,
  ),
  initial = store.load(repo);
const facade = new QuestPlannerFacade({
  repository: repo,
  router,
  bus,
  store,
  state: initial,
});
const pc = new JourneyPlaybackController(repo, bus);
let algorithm = "atlas",
  selectedOnly = false,
  follow = false,
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches,
  high = false;
try {
  const pref = JSON.parse(storage?.getItem("wayfarer-prefs") || "{}");
  reduced = pref.reduced ?? reduced;
  high = !!pref.high;
  algorithm = Object.hasOwn(strategies, pref.algorithm)
    ? pref.algorithm
    : "atlas";
} catch {}
function savePrefs() {
  try {
    storage?.setItem(
      "wayfarer-prefs",
      JSON.stringify({ reduced, high, algorithm }),
    );
  } catch {}
}
document.body.classList.toggle("high", high);
function hydrateRepo() {
  for (const q of quests)
    if (q.navigationOnly)
      q.giver = q.turnin = facade.state.placements?.[q.id] || q.defaultHub;
  repo.quests = [
    ...quests,
    ...waypoints,
    ...mappedQuests(facade.state.clientLog, facade.state.placements).map(
      (q) => ({ ...q, faction: sourceQuestById.get(q.clientId)?.faction }),
    ),
  ];
  facade.state.selected = facade.state.selected.filter((id) =>
    allowedQuest(repo.get(id), facade.state.profile.faction),
  );
}
hydrateRepo();
const map = new AtlasMap(repo, locationCard, () => {
  follow = false;
  $("mapTip").hidden = true;
});
let lastIndex = -1,
  lastRoute,
  raf = 0,
  pendingImport = null,
  travelTimes = new Map(),
  filterVersion = 0;
const say = (t) => ($("status").textContent = t);
const name = (id) => repo.location(id)?.name || "Location not available";
const option = (v, label, sel) =>
  `<option value="${esc(v)}" ${sel === v ? "selected" : ""}>${esc(label)}</option>`;
function decorate(root = document) {
  root.querySelectorAll("[data-i]").forEach((el) => {
    if (!el.querySelector(".icon"))
      el.insertAdjacentHTML("afterbegin", icon(el.dataset.i));
  });
}
function modal(title, html) {
  pc.pause(performance.now());
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = html;
  if (!$("modal").open) $("modal").showModal();
  $("modalBody").scrollTop = 0;
  decorate($("modalBody"));
}
function close() {
  $("modal").close();
}
function invoke(command) {
  return command.execute(facade);
}
function outputProgress() {
  return pc.route ? pc.state().progress : facade.state.progress;
}
function selectedQ() {
  return facade.state.selected.map((id) => repo.get(id)).filter(Boolean);
}
function nextPlace(q, progress) {
  const p = progressOf(progress, q.id);
  return !p.accepted
    ? q.giver
    : q.objectives.find((o) => (p.counts[o.id] || 0) < o.count)?.place ||
        q.turnin;
}
function visible() {
  const query = $("search").value.toLowerCase().trim(),
    zone = $("zoneFilter").value,
    status = $("statusFilter").value,
    time = $("timeFilter").value,
    progress = outputProgress();
  return repo.quests.filter(
    (q) =>
      allowedQuest(q, facade.state.profile.faction) &&
      (!q.waypoint || facade.state.selected.includes(q.id)) &&
      (!selectedOnly || facade.state.selected.includes(q.id)) &&
      (!query ||
        (q.title + " " + q.zone + " " + (q.gameId || "") + " " + q.id)
          .toLowerCase()
          .includes(query)) &&
      (zone === "All zones" || zone === q.zone) &&
      (status === "Any status" || status === questStatus(q, progress)) &&
      (time === "all" ||
        (travelTimes.get(nextPlace(q, progress)) ?? Infinity) <= Number(time)),
  );
}
function journal() {
  const s = facade.state,
    pr = outputProgress();
  $("origin").textContent =
    s.origin === "Sample" ? "Sample character" : s.origin;
  $("charName").textContent = s.profile.name;
  $("characterLine").textContent = s.profile.faction + " · " + s.profile.class;
  const permitted = Object.entries(s.profile).filter(
    ([k, v]) =>
      v === true &&
      [
        "mount",
        "fly",
        "boat",
        "zeppelin",
        "skyship",
        "tram",
        "portal",
        "teleport",
        "hearthReady",
        "device",
      ].includes(k),
  ).length;
  $("currentStyle").textContent =
    travelStyles[styleOf(s.profile)]?.title ||
    (permitted ? "Custom · foot + " + permitted : "On foot only");
  if (game)
    $("catalogCredit").innerHTML =
      esc(s.profile.faction) +
      ' &amp; shared quests · <a href="https://foreverdb.net" target="_blank" rel="noopener">Data from ForeverDB.net</a>';
  $("selCount").textContent = s.selected.length;
  const list = visible();
  $("questList").innerHTML = list.length
    ? list
        .slice(0, pageSize)
        .map((q) => {
          const checked = s.selected.includes(q.id),
            state = progressOf(pr, q.id),
            count = q.objectives.reduce(
              (n, o) => n + (state.counts[o.id] || 0),
              0,
            ),
            total = q.objectives.reduce((n, o) => n + o.count, 0);
          return `<div class="qrow"><input type="checkbox" aria-label="Select ${esc(q.title)}" data-select="${esc(q.id)}" ${checked ? "checked" : ""}><span class="questIcon ${q.icon}">${icon(q.icon)}</span><button class="qdetail" data-quest="${esc(q.id)}"><strong>${esc(q.title)}</strong><small>${esc(q.zone)} · ${q.waypoint ? "Travel stop" : q.navigationOnly ? "Staging only" : state.turnedIn ? "Turned in" : state.accepted ? count + "/" + total : "Lv. " + (q.level || "—")}</small></button></div>`;
        })
        .join("") +
      (list.length > pageSize
        ? '<button id="moreQuests">Show more · ' +
          list.length +
          " matches</button>"
        : "")
    : '<p class="empty">No matching quests. Adjust your search or filters.</p>';
}
function drawStops(route) {
  const ok = route?.status === "ok";
  $("eta").textContent = ok ? duration(route.totalCostSeconds) : "—";
  $("stopCount").textContent = ok ? route.stops.length : "—";
  const style = route?.travelStyle;
  $("styleSummary").hidden = !style;
  if (style) {
    const trips = style.eligibleTrips
      ? "transport on " +
        style.transportTrips +
        " of " +
        style.eligibleTrips +
        " eligible trips"
      : "no transport needed";
    $("styleSummary").textContent =
      style.preset === "foot"
        ? "On foot · walking only"
        : travelStyles[style.preset].title +
          " · " +
          trips +
          (style.mandatoryTrips
            ? " · " + style.mandatoryTrips + " required"
            : "");
  }
  $("method").textContent = strategies[route?.algorithmId || algorithm];
  if (!ok || !route.stops.length) {
    $("stops").innerHTML =
      `<p class="empty">${esc(route?.message || (facade.state.selected.length ? "Optimize your selection to see the route." : "Choose quests to plan your adventure."))}</p><button id="recover">${route?.code === "prerequisite" ? "Include prerequisite" : !facade.state.selected.length ? "Try sample adventure" : "Routing options"}</button>`;
    $("recover").onclick = () => {
      if (route?.code === "prerequisite") {
        facade.select([
          ...facade.state.selected,
          route.uncoveredRequiredIds.at(-1),
        ]);
        optimize();
      } else if (!facade.state.selected.length) loadSample();
      else settings(true);
    };
    return;
  }
  $("stops").innerHTML = route.stops
    .map((s, i) => {
      const travel = route.legs.filter(
          (l) => l.stopId === s.id && l.kind === "travel",
        ),
        method = [...new Set(travel.map((l) => modes[l.mode][0]))].join(" + ");
      return `<button class="stop" data-stop="${i}" title="${esc(repo.get(s.quest).title)}"><b>${i + 1}</b><span><strong>${esc(name(s.place))}</strong><small>${esc(s.label)}</small><small class="stopState">○ Upcoming</small><em>${esc(method || "On site")} · ${clock(s.endsAt)} ETA</em></span></button>`;
    })
    .join("");
}
function frame(s) {
  const changed = s.i !== lastIndex || pc.route !== lastRoute;
  lastIndex = s.i;
  lastRoute = pc.route;
  if (changed) {
    journal();
    map.markers(facade.state.selected, s.progress || facade.state.progress, s);
    const active = pc.route?.stops.findIndex(
      (stop) => stop.id === s.leg?.stopId,
    );
    for (const [i, row] of [
      ...$("stops").querySelectorAll("[data-stop]"),
    ].entries()) {
      const done = pc.route.stops[i].endsAt <= s.time;
      const label = done
        ? "✓ Reached"
        : i === active
          ? s.leg?.kind === "service"
            ? "◆ At stop"
            : "➤ En route"
          : "○ Upcoming";
      row.querySelector(".stopState").textContent = label;
      if (i === active && s.playing)
        $("stops").scrollTop = Math.max(
          0,
          row.offsetTop - $("stops").firstElementChild.offsetTop - 45,
        );
      row.classList.toggle("active", i === active);
      row.classList.toggle("complete", pc.route.stops[i].endsAt <= s.time);
      row.setAttribute("aria-current", i === active ? "step" : "false");
    }
    const completed =
      pc.route?.stops.filter((stop) => stop.endsAt <= s.time).length || 0;
    $("journeyStatus").innerHTML = pc.route
      ? completed +
        " of " +
        pc.route.stops.length +
        ' stops reached <button id="legLog">Travel log</button>'
      : "No route planned";
    if ($("legLog"))
      $("legLog").onclick = () => {
        const t = pc.time;
        modal(
          "Travel log",
          '<ol class="passageLog">' +
            pc.route.legs
              .map(
                (l, i) =>
                  "<li><b>" +
                  esc(
                    l.kind === "service"
                      ? pc.route.stops.find((v) => v.id === l.stopId).label
                      : name(l.from) + " → " + name(l.to),
                  ) +
                  "</b><small>" +
                  (l.endsAt <= t
                    ? "✓ Finished"
                    : i === pc.index
                      ? "➤ Current"
                      : "○ Upcoming") +
                  " · " +
                  esc(l.methodName || modes[l.mode][0]) +
                  " · " +
                  clock(l.endsAt - l.seconds) +
                  " – " +
                  clock(l.endsAt) +
                  "</small></li>",
              )
              .join("") +
            "</ol>",
        );
      };
    const movement = s.leg
      ? s.leg.phase
        ? (s.leg.phase === "board" ? "Board at " : "Land at ") + name(s.leg.to)
        : s.leg.kind === "travel"
          ? name(s.leg.from) + " → " + name(s.leg.to)
          : name(s.leg.to) +
            " · " +
            pc.route.stops.find((v) => v.id === s.leg.stopId)?.label
      : "";
    $("mapProgress").textContent = s.done
      ? "✓ Journey complete · " + name(pc.route.legs.at(-1)?.to)
      : s.leg
        ? modes[s.leg.mode][0] + " · " + movement
        : "Choose quests to chart a route";
    if (s.playing && s.i && pc.route?.legs[s.i - 1]?.kind === "service")
      say(
        "Recorded " +
          pc.route.stops.find(
            (stop) => stop.id === pc.route.legs[s.i - 1].stopId,
          )?.label +
          ".",
      );
  }
  map.frame(s, follow, reduced);
  $("seek").value = s.time;
  $("clock").textContent = clock(s.time) + " / " + clock(pc.duration);
  $("zoneReadout").textContent =
    repo.location(
      s.leg?.from || pc.route?.legs.at(-1)?.to || facade.state.profile.start,
    )?.zone || "Westreach Vale";
  const label = s.playing
    ? "Pause"
    : s.time > 0 && !s.done
      ? "Resume"
      : "Play Journey";
  if ($("play").dataset.label !== label) {
    $("play").dataset.label = label;
    $("play").innerHTML = icon(s.playing ? "pause" : "play") + label;
  }
  $("playState").textContent = s.done
    ? "Complete"
    : s.playing
      ? "Playing"
      : s.time
        ? "Paused"
        : "Ready";
  const vehicle = ["boat", "zeppelin", "tram", "fly"].includes(s.leg?.mode);
  const phase = vehicle
    ? s.fraction < 0.1
      ? "Boarding "
      : s.fraction > 0.9
        ? "Arriving by "
        : "Aboard "
    : "";
  $("nowLeg").textContent = s.done
    ? "Journey complete"
    : s.leg
      ? phase + modes[s.leg.mode][0] + " · " + duration(s.remaining) + " left"
      : "Awaiting route";
}
function schedule() {
  cancelAnimationFrame(raf);
  if (pc.playing)
    raf = requestAnimationFrame(function tick(now) {
      pc.tick(now);
      if (pc.playing) raf = requestAnimationFrame(tick);
    });
}
function drawRoute(r) {
  $("optimize").disabled = false;
  $("optimize").innerHTML = icon("route") + "Optimize Route";
  map.setProfile(projectedMethods(facade.state.profile));
  map.route(r);
  drawStops(r);
  const route = r?.status === "ok" ? r : null;
  $("seek").max = route?.totalCostSeconds || 1;
  for (const id of ["play", "prev", "next", "restart", "seek"])
    $(id).disabled = !route?.legs.length;
  lastIndex = -1;
  pc.reset(route, facade.state.progress, facade.state.profile.start);
  if (r)
    say(
      r.status === "ok"
        ? r.coveredCount +
            " required services covered · " +
            duration(r.travelSeconds) +
            " travel · " +
            duration(r.workSeconds) +
            " activity"
        : r.message,
    );
  else say("Selection changed. Optimize Route to update the itinerary.");
}
async function optimize() {
  try {
    await invoke(Commands.optimize(algorithm));
  } catch (e) {
    drawRoute(null);
    say("Planner unavailable. " + e.message);
    $("stops").innerHTML =
      '<p class="empty">The planner could not load. Reopen this page from its local server and try Optimize Route again.</p>';
  }
}
bus.on("journal", () => {
  hydrateRepo();
  journal();
  map.markers(facade.state.selected, outputProgress());
  if ($("timeFilter").value !== "all") refreshTravel();
});
bus.on("route", drawRoute);
bus.on("frame", frame);
bus.on("calculating", (busy) => {
  if (busy) {
    pc.pause();
    $("optimize").disabled = true;
    $("optimize").textContent = "Calculating…";
    say("Calculating your route…");
  }
});
function applySnapshot(s) {
  pc.pause();
  facade.history = [];
  facade.state = s;
  hydrateRepo();
  facade.invalidate();
  facade.save();
  map.reset();
  close();
  optimize();
}
function loadSample() {
  applySnapshot(sample());
}
function exportJSON(obj, file) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }),
  );
  a.href = url;
  a.download = file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function toggleQuest(id, on) {
  const ids = facade.state.selected;
  const q = repo.get(id);
  if (on && q?.navigationOnly && !q.giver) {
    journal();
    details(id);
    return;
  }
  if (on && ids.length >= 100) {
    say("Plan up to 100 quests at a time.");
    journal();
    return;
  }
  on ? facade.select([...ids, id]) : invoke(Commands.ignore(id));
}
function locationCard(id) {
  const p = repo.location(id);
  if (!p) return;
  const nearby = repo.quests.filter(
    (q) =>
      allowedQuest(q, facade.state.profile.faction) &&
      !q.navigationOnly &&
      [q.giver, q.turnin, ...q.objectives.map((o) => o.place)].includes(id),
  );
  $("mapTip").innerHTML =
    `<strong>${esc(p.name)}</strong><p>${esc(p.zone)} · ${esc(p.kind)}<br>${pc.route?.legs.slice(0, pc.index).some((l) => l.to === id) ? "✓ Reached · " : ""}${nearby.length} linked quests · Estimated geometry</p><button id="here">${game ? "Add travel stop" : "Plan here"}</button> ${game ? '<button id="startHere">Start here</button>' : ""} <button id="hideTip">Close</button>`;
  $("mapTip").hidden = false;
  $("hideTip").onclick = () => ($("mapTip").hidden = true);
  const stopInfo =
    pc.route?.stops
      .map((s, i) => ({ ...s, i }))
      .filter((s) => s.place === id) || [];
  if (stopInfo.length) {
    const detail = document.createElement("p");
    detail.textContent = stopInfo
      .map(
        (s) =>
          "#" + (s.i + 1) + " " + s.label + " · " + duration(s.work) + " work",
      )
      .join(" / ");
    $("mapTip").insertBefore(detail, $("here"));
  }
  if (game)
    $("startHere").onclick = () => {
      facade.change({ profile: { ...facade.state.profile, start: id } });
      $("mapTip").hidden = true;
      optimize();
    };
  $("here").onclick = () => {
    if (game) {
      toggleQuest("waypoint-" + id, true);
      $("mapTip").hidden = true;
      optimize();
      return;
    }
    const q = nearby.find(
      (q) => questStatus(q, facade.state.progress) !== "Locked",
    );
    if (q) {
      toggleQuest(q.id, true);
      $("mapTip").hidden = true;
      optimize();
    } else say("No eligible quest at this location.");
  };
}
function details(id) {
  const q = repo.get(id);
  if (!allowedQuest(q, facade.state.profile.faction)) return;
  const p = progressOf(outputProgress(), id),
    status = questStatus(q, outputProgress());
  if (q.waypoint) {
    modal(
      q.title,
      "<p>Travel stop · " +
        esc(q.zone) +
        '</p><button id="removeWaypoint">Remove travel stop</button>',
    );
    $("removeWaypoint").onclick = () => {
      toggleQuest(id, false);
      close();
      optimize();
    };
    return;
  }
  if (q.navigationOnly) {
    const sorted = [...places].sort(
      (a, b) =>
        Number(b.zone === q.zone) - Number(a.zone === q.zone) ||
        a.name.localeCompare(b.name),
    );
    modal(
      q.title,
      referenceCard(q) +
        '<fieldset><legend>Travel to a staging point</legend><p>The graph can plan travel to a mapped location. Fieldwork and turn-in are unmodeled for this entry.</p><label>Destination<select id="stagePlace">' +
        option("", "Choose a location", q.giver) +
        sorted
          .map((p) => option(p.id, p.name + " · " + p.zone, q.giver))
          .join("") +
        '</select></label><button id="stageAdd" class="gold">Plan travel here</button></fieldset>',
    );
    $("stageAdd").onclick = () => {
      const hub = $("stagePlace").value;
      if (!hub) {
        $("stagePlace").focus();
        return;
      }
      facade.change({ placements: { ...facade.state.placements, [id]: hub } });
      toggleQuest(id, true);
      close();
      optimize();
    };
    return;
  }
  const objectives = q.objectives
    .map(
      (o) =>
        `<label><input type="checkbox" data-include="${esc(o.id)}" ${facade.state.omitted.includes(id + "/" + o.id) ? "" : "checked"}> ${esc(o.label)} · ${p.counts[o.id] || 0}/${o.count}</label><small>${esc(name(o.place))}</small>`,
    )
    .join("");
  modal(
    q.title,
    `<p>${esc(q.id)} · ${esc(q.zone)} · ${esc(status)}${q.level ? " · Level " + q.level : ""}</p><p>Accept at <b>${esc(name(q.giver))}</b>. Turn in at <b>${esc(name(q.turnin))}</b>.</p><fieldset><legend>Planned objectives</legend>${objectives || "No counted objectives."}</fieldset><p>Prerequisites · ${q.requires.map((id) => esc(repo.get(id)?.title || id)).join(", ") || "None"}<br>Data · ${esc(q.source)} · ${q.clientId ? "Manual planning locations" : "Estimated locations and work times"}${q.reward ? "<br>Reward · " + esc(q.reward) : ""}</p><div class="actions"><button id="showPlace">Show on map</button><button id="toggleDetail">${facade.state.selected.includes(id) ? "Ignore quest" : "Select quest"}</button></div><details><summary>Manual progress</summary><p>Changes apply to the saved starting state. Playback progress can be kept in Playback options.</p><div id="manualActions"></div></details>${q.clientId ? '<div id="placements"></div>' : ""}`,
  );
  if (q.record)
    $("modalBody").insertAdjacentHTML("beforeend", referenceCard(q));
  const baseline = progressOf(facade.state.progress, id),
    bs = questStatus(q, facade.state.progress);
  const actions = [];
  if (bs === "Available") actions.push(["Accept quest", { kind: "accept" }]);
  if (bs === "Active")
    q.objectives
      .filter((o) => (baseline.counts[o.id] || 0) < o.count)
      .forEach((o) =>
        actions.push(["+1 " + o.label, { kind: "objective", objective: o.id }]),
      );
  if (bs === "Ready to turn in") actions.push(["Turn in", { kind: "turnin" }]);
  if (baseline.accepted) actions.push(["Reset / abandon", { kind: "abandon" }]);
  for (const [label, event] of actions) {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = () => {
      try {
        invoke(Commands.mark(id, event));
        details(id);
      } catch (e) {
        say(e.message);
      }
    };
    $("manualActions").append(b);
  }
  $("toggleDetail").onclick = () => {
    toggleQuest(id, !facade.state.selected.includes(id));
    details(id);
  };
  $("showPlace").onclick = () => {
    const place = repo.location(nextPlace(q, outputProgress()));
    if (!place) {
      say("Assign an estimated location first.");
      return;
    }
    close();
    tab("map");
    map.focus(place.point, 1.7);
    locationCard(place.id);
  };
  $("modalBody")
    .querySelectorAll("[data-include]")
    .forEach(
      (el) =>
        (el.onchange = () => {
          const key = id + "/" + el.dataset.include,
            prev = facade.state.omitted;
          facade.change({
            omitted: el.checked
              ? prev.filter((x) => x !== key)
              : [...new Set([...prev, key])],
          });
        }),
    );
  if (q.clientId) {
    $("placements").innerHTML =
      "<h3>Simulation locations</h3><p>Assign a mapped location to model travel. Original quest-log fields are preserved.</p>" +
      [
        ...q.objectives.map((o) => [o.id, o.label]),
        ["turnin", "Turn-in location"],
      ]
        .map(
          ([key, l]) =>
            `<label>${esc(l)}<select data-place="${esc(id + "/" + key)}">${option("", "Location not available", "")}${places.map((p) => option(p.id, p.name, facade.state.placements?.[id + "/" + key])).join("")}</select></label>`,
        )
        .join("");
    $("placements")
      .querySelectorAll("select")
      .forEach(
        (el) =>
          (el.onchange = () => {
            const v = { ...facade.state.placements };
            if (el.value) v[el.dataset.place] = el.value;
            else delete v[el.dataset.place];
            facade.change({ placements: v, origin: "Manually edited" });
            details(id);
          }),
      );
  }
}
function openJournal() {
  tab("map");
  $("journalHeading").focus({ preventScroll: true });
  document.querySelector(".journal").scrollIntoView({ block: "nearest" });
}
function chooseTravelStyle() {
  const active = styleOf(facade.state.profile);
  modal(
    "Travel style",
    '<p class="styleIntro">How would you like to travel?</p><div class="styleChoices">' +
      Object.entries(travelStyles)
        .map(
          ([id, s]) =>
            '<button class="styleCard" data-style="' +
            id +
            '" aria-pressed="' +
            (id === active) +
            '">' +
            icon(s.icon) +
            "<span><strong>" +
            s.title +
            "</strong><small>" +
            s.detail +
            "</small></span><b>" +
            s.share +
            "</b></button>",
        )
        .join("") +
      '</div><p class="styleNote">Percentages count trips between stops where transport helps. Mixed travel rounds up and keeps essential crossings.</p><button id="journalCustom">Custom travel settings</button>',
  );
  $("modalBody")
    .querySelectorAll("[data-style]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          facade.change({
            profile: { ...facade.state.profile, travelPreset: b.dataset.style },
          });
          close();
          optimize();
        }),
    );
  $("journalCustom").onclick = () => settings(true);
}
function tab(t) {
  document.querySelector(".workspace").dataset.view = t;
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) => b.setAttribute("aria-pressed", b.dataset.tab === t));
}
async function refreshTravel() {
  const version = ++filterVersion;
  if ($("timeFilter").value === "all") {
    journal();
    return;
  }
  const profile = { ...facade.state.profile };
  const times = new Map();
  for (const p of places) {
    const req = facade.request("nearest");
    req.profile = profile;
    req.quests = [
      {
        id: "filter",
        title: "Travel time",
        giver: p.id,
        turnin: p.id,
        objectives: [],
        requires: [],
      },
    ];
    req.progress = { filter: { accepted: true } };
    const r = await router.calculate(req);
    if (version !== filterVersion) return;
    times.set(p.id, r.status === "ok" ? r.travelSeconds : Infinity);
  }
  travelTimes = times;
  journal();
}
function routeOptions() {
  modal(
    "Routing options",
    `<label>Planning strategy <select id="strategy">${Object.entries(strategies)
      .map(([v, l]) => option(v, l, algorithm))
      .join(
        "",
      )}</select></label><p>Atlas prioritizes feasible chains of required services. Its route is heuristic and has no global optimality guarantee. Exact search is bounded to 12 services and a resource-aware state budget.</p><div class="actions"><button id="recalc" class="gold">Recalculate route</button><button id="routeVis">${map.layers.route ? "Hide" : "Show"} route</button></div>`,
  );
  $("recalc").onclick = () => {
    algorithm = $("strategy").value;
    savePrefs();
    close();
    optimize();
  };
  $("routeVis").onclick = () => {
    map.layers.route = !map.layers.route;
    map.transform();
    close();
  };
}
async function comparison() {
  modal(
    "Route comparison",
    '<p role="status">Calculating three routes for the same selection…</p>',
  );
  try {
    const results = await facade.compareStrategies();
    if (!$("modal").open || $("modalTitle").textContent !== "Route comparison")
      return;
    $("modalBody").innerHTML =
      "<p>Same start, objectives and travel unlocks. Costs include travel and quest activity.</p>" +
      results
        .map(
          (r) =>
            `<section><h3>${strategies[r.algorithmId]}</h3>${r.status !== "ok" ? "<p>" + esc(r.message) + "</p>" : `<b>${duration(r.totalCostSeconds)}</b> · ${r.isProvenOptimal ? "Proven model-optimal" : "Heuristic estimate"}<p>${duration(r.travelSeconds)} travel + ${duration(r.workSeconds)} activity · ${r.coveredCount}/${r.requiredCount} services<br>${r.runtimeMs.toFixed(2)} ms computation · ${r.gap === null ? "Gap unavailable" : r.gap.toFixed(1) + "% gap to exact"}</p>`}</section>`,
        )
        .join("") +
      '<p>Atlas looks ahead for nearby service chains. Nearest neighbor chooses the cheapest next eligible service. Held–Karp evaluates all feasible orders and resource allocations within its bound.</p><button id="exportRun">Export run metadata</button>';
    $("exportRun").onclick = () =>
      exportJSON(
        {
          timestamp: new Date().toISOString(),
          request: facade.request(algorithm),
          results,
        },
        "wayfarer-comparison.json",
      );
  } catch (e) {
    $("modalBody").textContent = e.message;
  }
}
function guide() {
  modal(
    "Field guide",
    `<p>Choose quests in your journal, optimize a route, then play the journey. Every marker and progress event comes from the returned itinerary.</p><h3>How Atlas works</h3><p>In the original Atlas problem, traversing a required road earns coverage. Here a required edge changes quest state at a location. Travel connects those services.</p><div id="lesson"></div><button id="lessonNext">Advance example</button><h3>Route estimates</h3><p>${game ? "Azeroth uses a 76-location travel graph. Both continents fit in Whole map. Routes and shorelines are schematic." : "Westreach is an original fictional scenario."} Model seconds come from travel edges and remaining objective work. At 1×, eight modeled seconds play in one real second. Teleports hold at their origin during the cast and jump at its end.</p><details><summary>Engineering and original showcase</summary><p>The Lua planner runs inside a local WebAssembly worker. An injected facade, validation chain and polymorphic strategy creators serve the journal. One playback clock drives map, tracker and timeline.</p><a href="engineering.html" target="_blank" rel="noopener">Architecture, diagrams and verification</a><br><a href="legacy.html" target="_blank" rel="noopener">Open the original Azeroth atlas and flight-coverage showcase</a></details>`,
  );
  let n = 0;
  function draw() {
    const labels = ["Accept", "Travel", "Gather", "Return", "Turn in"];
    $("lesson").innerHTML =
      '<svg viewBox="0 0 450 90" role="img" aria-label="Example service and travel transitions">' +
      labels
        .map(
          (l, i) =>
            `<g transform="translate(${36 + i * 92} 36)">${i < 4 ? '<path d="M15 0h61" stroke="#ada376" stroke-dasharray="4 3"/>' : ""}<circle r="15" fill="${i <= n ? "#527961" : "#333e32"}" stroke="#d6be76"/><text text-anchor="middle" y="5" fill="white">${i + 1}</text><text text-anchor="middle" y="40" font-size="14" fill="#e8e4ce">${l}</text></g>`,
        )
        .join("") +
      "</svg><p>" +
      [
        "Accepting unlocks objective work.",
        "Deadhead to the grove. Arrival changes location only.",
        "Complete the required gather service.",
        "Travel back with the item.",
        "Turn in the quest after every required count is met.",
      ][n] +
      "</p>";
    $("lessonNext").textContent =
      n === 4 ? "Restart example" : "Advance example";
  }
  draw();
  $("lessonNext").onclick = () => {
    n = (n + 1) % 5;
    draw();
  };
}
function travelUnlocks(p) {
  const choices = (items, known, attr) =>
    items
      .map(
        (v) =>
          '<label><input type="checkbox" data-' +
          attr +
          ' value="' +
          esc(v.id) +
          '" ' +
          (!known || known.includes(v.id) ? "checked" : "") +
          "> " +
          esc(v.name || name(v.id)) +
          (v.faction ? " · " + esc(v.faction) : "") +
          "</label>",
      )
      .join("");
  return (
    "<details><summary>Discovered flight masters</summary><p>Clear undiscovered stops. Faction and class restrictions apply automatically.</p>" +
    choices(data.masters, p.knownFlights, "flight") +
    "</details><details><summary>Learned teleport spells</summary>" +
    choices(data.spells, p.knownSpells, "spell") +
    "</details>"
  );
}
function settings(travel = false) {
  const p = facade.state.profile,
    placesOptions = (v) => places.map((t) => option(t.id, t.name, v)).join("");
  modal(
    travel === true ? "Custom travel" : "Character & settings",
    `<form id="profileForm">${travel === true ? "<details><summary>" + esc(p.name) + " · " + esc(p.faction) + " " + esc(p.class) + " · from " + esc(name(p.start)) + "</summary>" : ""}<label>Character name <input type="text" id="pName" required maxlength="60" value="${esc(p.name)}"></label><label>Faction <select id="pFaction">${["Alliance", "Horde"].map((x) => option(x, x, p.faction)).join("")}</select></label><label>Class <select id="pClass">${["Hunter", "Mage", "Warrior", "Shaman", "Druid", "Rogue", "Priest", "Paladin", "Warlock"].map((x) => option(x, x, p.class)).join("")}</select></label><label>Start <select id="pStart">${placesOptions(p.start)}</select></label>${travel === true ? "</details>" : ""}<details ${travel === true ? "open" : ""}><summary>Travel abilities and unlocks</summary><button type="button" id="footOnly">On foot only</button><p>Walking is always available on connected land. Select the other methods your character can use. Flight masters and class spells start unlocked in the sample.</p><label>Hearthstone bind <select id="pBind">${placesOptions(p.hearth)}</select></label>${Object.entries(
      {
        mount: "Mounted travel (+60% speed)",
        hearthReady: "Hearthstone ready · one use",
        fly: "Flight paths from discovered masters",
        boat: "Boats and ferries",
        zeppelin: "Horde zeppelin",
        tram: "Alliance tram",
        portal: game ? "Fixed world portals" : "Mage portal",
        teleport: game ? "Known class teleport spells" : "Mage recall spell",
        ...(game
          ? {
              skyship: "Skyborne skyships",
              ripper: "Dimensional Ripper · Everlook",
              transporter: "Ultrasafe Transporter · Gadgetzan",
            }
          : { device: "Waystone item · one use" }),
      },
    )
      .map(
        ([k, l]) =>
          `<label><input type="checkbox" data-profile="${k}" ${p[k] ? "checked" : ""}> ${l}</label>`,
      )
      .join(
        "",
      )}${game ? travelUnlocks(p) : ""}</details><button class="gold" type="submit">${travel === true ? "Apply & recalculate" : "Save character"}</button></form><h3>Preferences</h3><label><input id="reduce" type="checkbox" ${reduced ? "checked" : ""}> Reduced motion · step between locations</label><label><input id="contrast" type="checkbox" ${high ? "checked" : ""}> High contrast</label><h3>Snapshots</h3><p>Import a local journal or paste a quest log from <code>/waexport</code>. Review the preview before replacing this journal.</p><input type="file" accept="application/json,.json" id="file" aria-label="Import JSON snapshot"><label>Paste JSON<br><textarea id="paste" rows="3" style="width:100%" maxlength="256000"></textarea></label><button id="preview">Preview import</button> <button id="export">Export journal</button><div id="previewResult" role="status"></div><details><summary>Reset local data</summary><p>Clear saved progress and imported records and restore the sample adventure.</p><button id="clear">Clear imported data & reset</button></details>`,
  );
  $("footOnly").onclick = () => {
    document
      .querySelectorAll("[data-profile]")
      .forEach((el) => (el.checked = false));
  };
  $("profileForm").onsubmit = (e) => {
    e.preventDefault();
    const next = {
      ...p,
      name: $("pName").value.trim(),
      faction: $("pFaction").value,
      class: $("pClass").value,
      start: $("pStart").value,
      hearth: $("pBind").value,
    };
    if (!next.name) return;
    document
      .querySelectorAll("[data-profile]")
      .forEach((el) => (next[el.dataset.profile] = el.checked));
    if (game) {
      next.device = next.ripper || next.transporter;
      next.knownFlights = [
        ...document.querySelectorAll("[data-flight]:checked"),
      ].map((el) => el.value);
      next.knownSpells = [
        ...document.querySelectorAll("[data-spell]:checked"),
      ].map((el) => Number(el.value));
    }
    const changedMethods = [
      ...document.querySelectorAll("[data-profile]"),
    ].some((el) => next[el.dataset.profile] !== p[el.dataset.profile]);
    if (travel === true || changedMethods) next.travelPreset = "custom";
    if (next.faction !== p.faction) {
      facade.history = [];
      $("mapTip").hidden = true;
      pageSize = 40;
    }
    const selected = facade.state.selected.filter((id) =>
      allowedQuest(repo.get(id), next.faction),
    );
    facade.change({ profile: next, selected, origin: "Manually edited" });
    close();
    optimize();
  };
  $("reduce").onchange = (e) => {
    reduced = e.target.checked;
    savePrefs();
    pc.emit();
  };
  $("contrast").onchange = (e) => {
    high = e.target.checked;
    document.body.classList.toggle("high", high);
    savePrefs();
  };
  function preview(raw) {
    pendingImport = null;
    try {
      pendingImport = previewImport(raw, repo);
      const s = pendingImport;
      $("previewResult").innerHTML =
        `<h3>Import preview</h3><p>${s.clientLog ? s.clientLog.quests.length + " client quest records · captured " + esc(new Date(s.clientLog.capturedAt * 1000).toISOString()) + " · assign unknown locations in quest details." : esc(s.profile.name) + " · " + s.selected.length + " selected quests · " + esc(s.timestamp)}</p><button id="confirmImport">Use this snapshot</button>`;
      $("confirmImport").onclick = () => applySnapshot(s);
    } catch (e) {
      $("previewResult").textContent = e.message;
    }
  }
  $("file").onchange = async (e) => {
    const f = e.target.files[0];
    if (f) {
      if (f.size > 256000) {
        $("previewResult").textContent = "Snapshot exceeds the 256 KB limit.";
        return;
      }
      preview(await f.text());
    }
  };
  $("preview").onclick = () => preview($("paste").value);
  $("export").onclick = () => exportJSON(facade.state, "wayfarer-journal.json");
  $("clear").onclick = () => {
    store.clear();
    loadSample();
  };
}
function playbackOptions() {
  modal(
    "Playback options",
    `<p>1× plays eight modeled seconds per real second. Remaining journey time · ${duration(pc.state().remaining)}.</p><label><input id="follow" type="checkbox" ${follow ? "checked" : ""}> Follow character</label><div class="actions"><button id="skipLeg">Skip current leg</button><button id="skipAll">Skip to finish</button><button id="focusLeg">Focus current leg</button><button id="keep">Keep simulated progress</button></div><p>Keeping progress saves completed service events and the last reached location. The next route begins there.</p>`,
  );
  $("focusLeg").onclick = () => {
    close();
    const leg = pc.state().leg;
    if (leg) {
      map.fit({ legs: [leg] });
      tab("map");
    }
  };
  $("follow").onchange = (e) => (follow = e.target.checked);
  $("skipLeg").onclick = () => {
    close();
    pc.skipLeg();
  };
  $("skipAll").onclick = () => {
    close();
    pc.seek(pc.duration);
  };
  const s = pc.state();
  $("keep").disabled = !pc.route || s.time === 0;
  $("keep").onclick = () => {
    const legs = pc.route.legs.slice(0, s.i),
      start = legs.at(-1)?.to || facade.state.profile.start;
    const used = legs.map((l) => l.mode);
    const profile = facade.state.profile;
    const usedNames = new Set(legs.map((l) => l.methodName));
    const ripper =
      !!profile.ripper && !usedNames.has("Dimensional Ripper - Everlook");
    const transporter =
      !!profile.transporter &&
      !usedNames.has("Ultrasafe Transporter: Gadgetzan");
    const visited = new Set(
      legs.filter((l) => l.mode === "visit").map((l) => l.quest),
    );
    facade.change({
      progress: s.progress,
      selected: facade.state.selected.filter((id) => !visited.has(id)),
      profile: {
        ...facade.state.profile,
        start,
        hearthReady:
          facade.state.profile.hearthReady && !used.includes("hearth"),
        device: game
          ? ripper || transporter
          : profile.device && !used.includes("device"),
        ...(game
          ? {
              ripper,
              transporter,
              ...(usedNames.has("Astral Recall")
                ? {
                    knownSpells: (
                      profile.knownSpells || data.spells.map((s) => s.id)
                    ).filter((id) => id !== 556),
                  }
                : {}),
            }
          : {}),
      },
      origin: "Simulation",
    });
    close();
    optimize();
  };
}
function layerMenu() {
  const menu = $("layerMenu");
  menu.hidden = !menu.hidden;
  $("layers").setAttribute("aria-expanded", !menu.hidden);
  menu.innerHTML =
    Object.entries({
      route: "Planned route",
      quests: "Quest markers",
      labels: "Place names",
      graph: "Travel connections",
      ...(game ? {} : { zones: "Zone boundaries" }),
    })
      .map(
        ([k, l]) =>
          `<label><input type="checkbox" data-layer="${k}" ${map.layers[k] ? "checked" : ""}> ${l}</label>`,
      )
      .join("") +
    '<button id="resetMap">Reset map</button>' +
    (game ? '<button id="zoneAtlas">Browse zone maps</button>' : "");
  if (game)
    $("zoneAtlas").onclick = () => {
      menu.hidden = true;
      $("layers").setAttribute("aria-expanded", "false");
      const faction = facade.state.profile.faction;
      if (!factionIndexes.has(faction))
        factionIndexes.set(
          faction,
          indexZones(quests.filter((q) => allowedQuest(q, faction))),
        );
      showZoneAtlas(
        factionIndexes.get(faction),
        $("zoneReadout").textContent,
        modal,
        details,
      );
    };
  menu.querySelectorAll("input").forEach(
    (el) =>
      (el.onchange = () => {
        map.layers[el.dataset.layer] = el.checked;
        map.markers(facade.state.selected, outputProgress());
        map.transform();
      }),
  );
  $("resetMap").onclick = () => {
    follow = false;
    map.reset();
    menu.hidden = true;
    $("layers").setAttribute("aria-expanded", "false");
  };
}
function legend() {
  modal(
    "Map legend",
    '<p>Checks mark reached locations. Numbered markers show the next outstanding visit. A diamond marks work, an exclamation marks acceptance and a question mark marks turn-in. Red dotted network links are restricted. The player marker changes with the active travel mode. Dashed lines follow modeled graph connections; terrain and route geometry are illustrative.</p><div class="modeGrid">' +
      Object.entries(modes)
        .filter(([k]) => !["accept", "turnin", "objective"].includes(k))
        .map(
          ([k, m]) =>
            `<div><svg aria-hidden="true"><path d="M1 8h34" stroke="${m[3]}" stroke-width="3" stroke-dasharray="${m[2]}"/></svg>${icon(m[1])} ${m[0]}</div>`,
        )
        .join("") +
      "</div>",
  );
}
function bind() {
  const click = {
    wholeMap: () => {
      follow = false;
      map.reset();
      $("mapTip").hidden = true;
    },
    expandMap: () => {
      const panel = document.querySelector(".mapPanel");
      const expanded = panel.classList.toggle("expanded");
      $("expandMap").textContent = expanded ? "Close" : "Expand";
      $("expandMap").setAttribute("aria-pressed", expanded);
    },
    travelStyle: chooseTravelStyle,
    travelMethods: () => settings(true),
    mobileTravel: () => settings(true),
    settings,
    editProfile: settings,
    compareNav: comparison,
    compare: comparison,
    guideNav: guide,
    plannerNav: openJournal,
    routeSettings: routeOptions,
    layers: layerMenu,
    legend,
    adventure: () => {
      if (game) {
        modal(
          "Choose an adventure",
          '<h3>Azeroth</h3><p>76 mapped locations and 4,753 indexed quest IDs. The journal shows your faction and shared quests with confirmed eligibility. Sixteen curated quest models include timed services. Other entries support staging-point travel.</p><a href="?adventure=westreach">Open Westreach practice journal</a><p><button id="trySample" class="gold">Restore Azeroth sample</button> <button id="importInstead">Import quest data</button></p>',
        );
        $("trySample").onclick = loadSample;
        $("importInstead").onclick = settings;
        return;
      }
      modal(
        "Sample adventure",
        '<a href="./">Open Azeroth world atlas</a><h3>Westreach Vale</h3><p>Explore three fictional zones with Elara Windborne, an Alliance hunter. The expedition starts at Wayfarer’s Rest with three active quests.</p><button id="trySample" class="gold">Try sample adventure</button> <button id="importInstead">Import quest data</button>',
      );
      $("trySample").onclick = loadSample;
      $("importInstead").onclick = settings;
    },
    closeModal: close,
    optimize,
    mobileOptimize: optimize,
    resetRoute: () => invoke(Commands.reset()),
    play: () => {
      pc.playing ? pc.pause(performance.now()) : pc.play(performance.now());
      schedule();
    },
    prev: () => pc.step(-1),
    next: () => pc.step(1),
    restart: () => {
      pc.pause();
      pc.seek(0);
    },
    morePlay: playbackOptions,
    zoomIn: () => map.scale(1.25),
    zoomOut: () => map.scale(0.8),
    fit: () => {
      follow = false;
      map.fit(pc.route);
    },
    recenter: () => {
      follow = true;
      map.focus(pc.state().point, Math.max(1.4, map.zoom));
    },
    filterBtn: () => {
      $("filters").hidden = !$("filters").hidden;
    },
    zoneAll: () =>
      facade.select([
        ...facade.state.selected,
        ...visible()
          .filter((q) => !q.navigationOnly || q.giver)
          .slice(0, Math.min(pageSize, 100 - facade.state.selected.length))
          .map((q) => q.id),
      ]),
    deselect: () => facade.select([]),
    undo: () => facade.undo(),
  };
  for (const [id, fn] of Object.entries(click)) $(id).onclick = fn;
  for (const id of ["allTab", "selectedTab"])
    $(id).onclick = () => {
      selectedOnly = id === "selectedTab";
      $("allTab").setAttribute("aria-pressed", !selectedOnly);
      $("selectedTab").setAttribute("aria-pressed", selectedOnly);
      journal();
    };
  $("search").oninput = () => {
    pageSize = 40;
    journal();
  };
  $("zoneFilter").onchange = journal;
  $("statusFilter").onchange = journal;
  $("timeFilter").onchange = refreshTravel;
  $("zoneFilter").innerHTML = [
    "All zones",
    ...Object.keys(zones),
    "Imported quest",
  ]
    .map((z) => option(z, z, "All zones"))
    .join("");
  $("questList").onchange = (e) => {
    const id = e.target.dataset.select;
    if (id) toggleQuest(id, e.target.checked);
  };
  $("questList").onclick = (e) => {
    const id = e.target.closest("[data-quest]")?.dataset.quest;
    if (e.target.id === "moreQuests") {
      pageSize += 40;
      journal();
      return;
    }
    if (id) details(id);
  };
  $("stops").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-stop]");
    if (!btn || !pc.route) return;
    const s = pc.route.stops[Number(btn.dataset.stop)],
      leg = pc.route.legs.find((l) => l.stopId === s.id);
    if (!pc.playing) pc.seek(leg.endsAt - leg.seconds);
    follow = false;
    map.focus(repo.location(s.place).point, 1.45);
    tab("map");
    locationCard(s.place);
  });
  $("speed").onchange = (e) =>
    pc.setSpeed(Number(e.target.value), performance.now());
  $("seek").oninput = (e) => pc.seek(Number(e.target.value));
  document
    .querySelectorAll("[data-tab]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          b.dataset.tab === "map" ? openJournal() : tab(b.dataset.tab)),
    );
  document.querySelector(".playback").addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT"].includes(e.target.tagName)) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      pc.step(e.key === "ArrowLeft" ? -1 : 1);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.querySelector(".mapPanel.expanded"))
      $("expandMap").click();
    if (
      e.code === "Space" &&
      !e.repeat &&
      !$("modal").open &&
      (e.target === document.body || e.target === $("world"))
    ) {
      e.preventDefault();
      $("play").click();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pc.pause(performance.now());
  });
}
if (game) {
  $("adventure").innerHTML = "Azeroth <span>World atlas</span>";
  document.querySelector(".mapName").innerHTML =
    "<span>World atlas</span><strong>Azeroth</strong>";
  $("world").setAttribute(
    "aria-label",
    "Azeroth world map. Select a location for details.",
  );
  document
    .querySelector("#camera image")
    .setAttribute("href", "assets/azeroth.webp");
  $("catalogCredit").innerHTML =
    '4,753 quest IDs · <a href="https://foreverdb.net" target="_blank" rel="noopener">Data from ForeverDB.net</a>';
} else {
  $("adventure").innerHTML = "Westreach Vale <span>Sample adventure</span>";
  document.querySelector(".mapName").innerHTML =
    "<span>Regional atlas</span><strong>Westreach Vale</strong>";
  $("world").setAttribute(
    "aria-label",
    "Westreach Vale map. Select a marker for location details.",
  );
  document
    .querySelector("#camera image")
    .setAttribute("href", "assets/atlas-map.webp");
}
decorate();
bind();
journal();
drawRoute(null);
optimize();
