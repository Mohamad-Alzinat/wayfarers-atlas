import { applyEvent } from "./domain.mjs";
export function interpolate(path, t) {
  if (path.length < 2) return { point: path[0], angle: 0 };
  const lengths = path
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  let distance = lengths.reduce((a, b) => a + b, 0) * t;
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const a = path[i],
        b = path[i + 1],
        f = lengths[i] ? Math.min(1, distance / lengths[i]) : 0;
      return {
        point: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f],
        angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
      };
    }
    distance -= lengths[i];
  }
}
export class JourneyPlaybackController {
  constructor(repository, bus) {
    this.repo = repository;
    this.bus = bus;
    this.speed = 1;
    this.reset(null, {}, null);
  }
  reset(route, progress, start) {
    this.route = route?.status === "ok" ? route : null;
    this.start = start;
    this.time = 0;
    this.playing = false;
    this.last = null;
    let snapshot = structuredClone(progress);
    this.checkpoints = [snapshot];
    for (const leg of this.route?.legs || []) {
      if (leg.kind === "service")
        snapshot = applyEvent(snapshot, this.repo.get(leg.quest), {
          kind: leg.mode,
          objective: leg.objective,
          target: leg.target,
        });
      this.checkpoints.push(snapshot);
    }
    this.emit();
  }
  get duration() {
    return this.route?.totalCostSeconds || 0;
  }
  get index() {
    const i = this.route?.legs.findIndex((l) => l.endsAt > this.time);
    return i >= 0 ? i : this.route?.legs.length || 0;
  }
  state() {
    const i = this.index,
      leg = this.route?.legs[i],
      previous = this.route?.legs[i - 1];
    const loc = this.repo.location(leg?.from || previous?.to || this.start);
    let pose = { point: loc?.point || [500, 400], angle: 0 },
      fraction = 0;
    if (leg) {
      fraction = leg.seconds
        ? Math.min(
            1,
            Math.max(0, (this.time - (leg.endsAt - leg.seconds)) / leg.seconds),
          )
        : 1;
      const path = leg.path || [loc.point, this.repo.location(leg.to).point];
      const instant = ["portal", "hearth", "teleport", "device"].includes(
        leg.mode,
      );
      pose = interpolate(
        path,
        leg.kind === "service" || instant ? 0 : fraction,
      );
    }
    return {
      i,
      leg,
      progress: this.checkpoints[i],
      ...pose,
      fraction,
      time: this.time,
      remaining: this.duration - this.time,
      playing: this.playing,
      done: this.duration > 0 && this.time >= this.duration,
    };
  }
  emit() {
    this.bus.emit("frame", this.state());
  }
  seek(t) {
    this.time = Math.min(this.duration, Math.max(0, Number(t) || 0));
    this.last = null;
    if (this.time >= this.duration) this.playing = false;
    this.emit();
  }
  play(now) {
    if (!this.duration) return;
    if (this.time >= this.duration) this.seek(0);
    this.playing = true;
    this.last = now;
    this.emit();
  }
  pause(now) {
    if (this.playing && now != null) this.tick(now);
    this.playing = false;
    this.last = null;
    this.emit();
  }
  tick(now) {
    if (!this.playing) return;
    if (this.last !== null)
      this.time = Math.min(
        this.duration,
        this.time + (Math.max(0, now - this.last) / 1000) * this.speed * 8,
      );
    this.last = now;
    if (this.time >= this.duration) this.playing = false;
    this.emit();
  }
  setSpeed(n, now) {
    if (![1, 2, 4].includes(n)) return;
    if (this.playing) this.tick(now);
    this.speed = n;
  }
  step(direction) {
    const stops = this.route?.stops || [];
    const target =
      direction > 0
        ? stops.find((s) => s.endsAt > this.time + 0.001)
        : [...stops].reverse().find((s) => s.endsAt < this.time - 0.001);
    this.seek(target?.endsAt ?? (direction > 0 ? this.duration : 0));
  }
  skipLeg() {
    this.seek(this.state().leg?.endsAt ?? this.duration);
  }
}
