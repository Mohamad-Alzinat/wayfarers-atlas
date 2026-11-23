import { VERSION, graph } from "./catalog.mjs";
export const initialProgress = () => ({
  accepted: false,
  turnedIn: false,
  counts: {},
});
export function progressOf(progress, id) {
  return progress[id] || initialProgress();
}
export function questStatus(q, progress) {
  const p = progressOf(progress, q.id);
  if (p.turnedIn) return "Turned in";
  if (q.requires.some((id) => !progress[id]?.turnedIn)) return "Locked";
  if (!p.accepted) return "Available";
  return q.objectives.every((o) => (p.counts[o.id] || 0) >= o.count)
    ? "Ready to turn in"
    : "Active";
}
export function applyEvent(progress, q, event) {
  if (event.kind === "visit") return progress;
  const state = progressOf(progress, q.id),
    status = questStatus(q, progress);
  const next = { ...state, counts: { ...state.counts } };
  switch (event.kind) {
    case "abandon":
      return { ...progress, [q.id]: initialProgress() };
    case "accept":
      if (status !== "Available")
        throw Error("This quest cannot be accepted yet.");
      next.accepted = true;
      break;
    case "objective": {
      const o = q.objectives.find((o) => o.id === event.objective);
      if (!o || !state.accepted || state.turnedIn || status === "Locked")
        throw Error("Accept the quest before recording work.");
      const count = event.target ?? (state.counts[o.id] || 0) + 1;
      if (
        !Number.isInteger(count) ||
        count < (state.counts[o.id] || 0) ||
        count > o.count
      )
        throw Error("Objective count is outside its range.");
      next.counts[o.id] = count;
      break;
    }
    case "turnin":
      if (status !== "Ready to turn in")
        throw Error("Finish all objectives before turn-in.");
      next.turnedIn = true;
      break;
    default:
      throw Error("Unknown quest event.");
  }
  return { ...progress, [q.id]: next };
}
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }
  on(type, fn) {
    const set = this.listeners.get(type) || new Set();
    this.listeners.set(type, set);
    set.add(fn);
    return () => set.delete(fn);
  }
  emit(type, payload) {
    for (const fn of this.listeners.get(type) || []) fn(payload);
  }
}
export const Commands = {
  optimize: (algorithm) => ({ execute: (f) => f.planJourney(algorithm) }),
  reset: () => ({ execute: (f) => f.invalidate() }),
  ignore: (id) => ({
    execute: (f) => f.select(f.state.selected.filter((q) => q !== id)),
  }),
  mark: (id, event) => ({ execute: (f) => f.applyQuestEvent(id, event) }),
};
export class QuestPlannerFacade {
  constructor({ repository, router, bus, store, state }) {
    Object.assign(this, { repository, router, bus, store, state });
    this.route = null;
    this.revision = 0;
    this.history = [];
  }
  getAvailableQuests() {
    return this.repository.quests;
  }
  request(algorithm) {
    return {
      graph: {
        ...graph,
        version: this.repository.version || VERSION,
        places: this.repository.places,
        edges: this.repository.edges,
      },
      algorithm,
      profile: this.state.profile,
      quests: this.state.selected.map((id) => {
        const { record, ...service } = this.repository.get(id);
        return service;
      }),
      omitted: this.state.omitted,
      progress: this.state.progress,
    };
  }
  invalidate() {
    this.revision++;
    this.route = null;
    this.bus.emit("route", null);
  }
  save() {
    this.state.timestamp = new Date().toISOString();
    this.store.save(this.state);
    this.bus.emit("journal", this.state);
  }
  change(update) {
    this.invalidate();
    this.state = { ...this.state, ...update };
    this.save();
  }
  select(ids) {
    this.history.push(this.state.selected);
    this.change({ selected: [...new Set(ids)] });
  }
  undo() {
    const selected = this.history.pop();
    if (selected) this.change({ selected });
  }
  applyQuestEvent(id, event) {
    if (
      event.kind === "abandon" &&
      this.repository.quests.some(
        (q) => q.requires.includes(id) && this.state.progress[q.id]?.accepted,
      )
    )
      throw Error(
        "Reset dependent quests before abandoning their prerequisite.",
      );
    const progress = applyEvent(
      this.state.progress,
      this.repository.get(id),
      event,
    );
    this.change({
      progress,
      origin: "Manually edited",
      selected:
        event.kind === "abandon"
          ? this.state.selected.filter((x) => x !== id)
          : this.state.selected,
    });
    this.bus.emit("progress", { id, event });
  }
  async planJourney(algorithm = "atlas") {
    const token = ++this.revision;
    this.bus.emit("calculating", true);
    try {
      const result = await this.router.calculate(this.request(algorithm));
      if (token !== this.revision) return null;
      this.route = result;
      this.bus.emit("route", result);
      return result;
    } finally {
      if (token === this.revision) this.bus.emit("calculating", false);
    }
  }
  async compareStrategies() {
    const results = [];
    const token = this.revision;
    const requests = ["atlas", "exact", "nearest"].map((id) =>
      this.request(id),
    );
    for (const req of requests) {
      const r = await this.router.calculate(req);
      results.push({ ...r, algorithmId: req.algorithm });
    }
    if (token !== this.revision)
      throw Error("The selection changed. Run the comparison again.");
    const exact = results.find((r) => r.status === "ok" && r.isProvenOptimal);
    return results.map((r) => ({
      ...r,
      gap:
        r.status === "ok" && exact?.totalCostSeconds > 0
          ? (100 * (r.totalCostSeconds - exact.totalCostSeconds)) /
            exact.totalCostSeconds
          : null,
    }));
  }
}
