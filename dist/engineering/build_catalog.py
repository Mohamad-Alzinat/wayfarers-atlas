"""Build Wayfarer's Atlas's local reference catalog from pinned, checksummed data.

python build_catalog.py --checkout ../game-database --out catalog.json
Omit --checkout to download the same four public data files over HTTPS.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen


REPOSITORY = "https://github.com/tyler3497/forever-quests"
REVISION = "9f4c5aac2d077854d7f4a2bdc2f8eceb8d7b23af"
RAW = f"https://raw.githubusercontent.com/tyler3497/forever-quests/{REVISION}"
INPUTS = {
    "foreverdb/data/meta.json": "46656ea4dbee3123f80033e898178157a1ee3f659a3ac48de2a776395b2031d2",
    "foreverdb/data/quests.json": "85ae2256bdf9f8610aa8ee94aab5ef8f6b295f811aa0480d02dc0526b0379b19",
    "data/quests.json": "e79cb39ddba55cc66a5238b07f83c5a16e3f8521b847cc2cdc641a52bb776c46",
    "data/zones.json": "5938231396a0da18282529409b67bb6e1490d0c5768bd56cb65ef6bce512c463",
}


def load_source(path, checkout):
    if checkout:
        binary = (checkout / path).read_bytes()
    else:
        request = Request(f"{RAW}/{path}", headers={"User-Agent": "Wayfarers-Atlas-Catalog/1"})
        with urlopen(request, timeout=45) as response:
            binary = response.read(10_000_001)
    binary = binary.replace(b"\r\n", b"\n")
    if hashlib.sha256(binary).hexdigest() != INPUTS[path]:
        raise ValueError(f"Unexpected contents for {path}")
    return json.loads(binary)


def endpoint(record):
    if not record:
        return None
    loc = record.get("location") or {}
    x, y = loc.get("x"), loc.get("y")
    if not (isinstance(x, (int, float)) and isinstance(y, (int, float))
            and 0 <= x <= 100 and 0 <= y <= 100 and loc.get("uiMapId")):
        x, y = None, None
    return {
        "id": record.get("id"), "name": record.get("name"), "type": record.get("type"),
        "mapId": loc.get("uiMapId"), "zone": loc.get("zone"), "x": x, "y": y,
        "source": loc.get("source") or record.get("source"),
        "players": record.get("players"), "instance": record.get("instance"),
    }


def objective_facts(record, map_ids):
    objectives = record.get("objectives") or {}
    facts = []
    for kind in ("items", "objects", "creatures"):
        for row in objectives.get(kind, []):
            if isinstance(row, list) and row and isinstance(row[0], int):
                facts.append({"kind": kind, "id": row[0]})
    rep = objectives.get("reputation")
    if isinstance(rep, list) and len(rep) == 2 and all(isinstance(n, int) for n in rep):
        facts.append({"kind": "reputation", "id": rep[0], "threshold": rep[1]})
    for area in (record.get("triggerEnd") or {}).get("zones", []):
        zone_id = area.get("zoneId")
        points = [p for p in area.get("coords", []) if isinstance(p, list) and len(p) == 2
                  and all(isinstance(n, (int, float)) and 0 <= n <= 100 for n in p)
                  and p != [0, 0]]
        if points:
            facts.append({"kind": "exploration", "areaId": zone_id, "mapId": map_ids.get(zone_id),
                          "points": points})
    return facts


def make_row(key, observed, compiled, map_ids, names_by_map):
    f, c = observed.get(key, {}), compiled.get(key, {})
    zone = f.get("zone") or {}
    map_id = zone.get("m") or map_ids.get(c.get("areaId"))
    chain = f.get("chain") or {}
    def links(records):
        return [{"id": item["questId"], "relation": item.get("relation"), "source": item.get("source")}
                for item in records if isinstance(item, dict) and item.get("questId")]
    return {
        "id": int(key), "title": f.get("name") or c["name"],
        "level": f.get("level", c.get("questLevel")), "requiredLevel": f.get("requiredLevel", c.get("requiredLevel")),
        "zone": zone.get("n") or names_by_map.get(map_id), "mapId": map_id, "category": f.get("category"),
        "side": {"a": "Alliance", "h": "Horde", "both": "Both"}.get(f.get("side")),
        "confidence": f.get("source", "catalog"),
        "sourceUrl": f.get("url") or f"{REPOSITORY}/blob/{REVISION}/data/quests.json",
        "accept": endpoint(f.get("starts")), "turnIn": endpoint(f.get("ends")),
        "prerequisites": links(chain.get("previous", [])), "next": links(chain.get("next", [])),
        "objectiveFacts": objective_facts(c, map_ids),
        "catalogFacts": {
            key: c[key] for key in ("areaId", "requiredRaces", "requiredClasses", "preQuestGroup",
                                    "preQuestSingle", "exclusiveTo", "startedBy", "finishedBy")
            if key in c
        } if c else None,
    }


def build(checkout):
    meta, observed, compiled, zones = [load_source(path, checkout) for path in INPUTS]
    map_ids = {row["areaId"]: row.get("uiMapId") for row in zones}
    names_by_map = {z["m"]: z["n"] for row in observed.values() if (z := row.get("zone"))
                    and z.get("m") and z.get("n")}
    rows = [make_row(key, observed, compiled, map_ids, names_by_map)
            for key in sorted(observed.keys() | compiled.keys(), key=int)]
    counts = {"unique": len(rows), "foreverDbListed": len(observed), "compiled": len(compiled),
              "inBoth": len(observed.keys() & compiled.keys()), "foreverDbMeta": meta["api_meta"]["quests"],
              "rowsWithObjectiveFacts": sum(bool(r["objectiveFacts"]) for r in rows),
              "rowsWithChainPredecessors": sum(bool(r["prerequisites"]) for r in rows),
              "sourceRows": dict(collections.Counter(r["confidence"] for r in rows))}
    for field in ("accept", "turnIn"):
        counts[field + "CoordinatesBySource"] = dict(collections.Counter(
            e["source"] for r in rows if (e := r[field]) and e["x"] is not None
        ))
    return {"version": 1, "source": "Data from ForeverDB.net", "sourceUrl": "https://foreverdb.net",
            "build": meta["api_meta"]["build"], "snapshotTime": meta["fetched_at_utc"],
            "supplement": "forever-quests v1.3.0", "sourceRevision": REVISION,
            "counts": counts, "quests": rows}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkout", type=Path)
    parser.add_argument("--out", type=Path, default=Path("catalog.json"))
    args = parser.parse_args()
    result = build(args.checkout)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(result["counts"], indent=2))
