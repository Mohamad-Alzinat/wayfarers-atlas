export const travelStyles = {
  foot: {
    title: "On foot",
    share: "0%",
    icon: "footprints",
    detail:
      "Walk every route segment. Water crossings that require a vessel are unavailable.",
  },
  mixed: {
    title: "Mixed travel",
    share: "50%",
    icon: "signpost",
    detail:
      "Use transport on about half of eligible trips between stops. Keep required crossings and the rides that save the most time.",
  },
  full: {
    title: "Full transport",
    share: "100%",
    icon: "route",
    detail:
      "Use transport wherever it improves the route. Walk the connections your character still needs.",
  },
};

export function allowedQuest(q, faction) {
  if (!q) return false;
  if (q.faction) return q.faction === faction;
  if (q.record) return q.record.side === "Both";
  return true;
}

// Snapshot imports without a style keep their original method permissions.
export function styleOf(profile) {
  return profile.travelPreset || "custom";
}
export function projectedMethods(p) {
  const style = styleOf(p),
    methods = { ...p };
  if (style === "custom") return methods;
  for (const key of [
    "fly",
    "boat",
    "skyship",
    "zeppelin",
    "tram",
    "portal",
    "teleport",
  ])
    methods[key] = style !== "foot";
  if (style === "foot")
    for (const key of ["mount", "hearthReady", "device"]) methods[key] = false;
  return methods;
}
