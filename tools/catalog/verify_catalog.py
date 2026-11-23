"""Verify the catalog revision's structural and attribution invariants."""
import json
from pathlib import Path
import sys
from urllib.parse import urlsplit

data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
rows = data["quests"]
ids = [row["id"] for row in rows]
assert ids == sorted(set(ids))
assert len(ids) == 4753 == data["counts"]["unique"]
assert data["counts"]["inBoth"] == 3739
assert data["counts"]["foreverDbListed"] == 3862
assert data["counts"]["compiled"] == 4630
assert sum(bool(row["objectiveFacts"]) for row in rows) == 2794
assert all(row["title"] and row["confidence"] in {"classic", "forever", "catalog"} for row in rows)
for row in rows:
    assert urlsplit(row["sourceUrl"]).hostname in {"foreverdb.net", "github.com"}
    for field in ("accept", "turnIn"):
        point = row[field]
        if point:
            assert (point["x"] is None) == (point["y"] is None)
            if point["x"] is not None:
                assert point["mapId"] and point["source"]
                assert 0 <= point["x"] <= 100 and 0 <= point["y"] <= 100
    if row["confidence"] == "catalog":
        assert row["accept"] is None and row["turnIn"] is None
example = next(r for r in rows if r["id"] == 56)
assert (example["title"], example["mapId"]) == ("The Night Watch", 1431)
assert (example["accept"]["x"], example["accept"]["y"]) == (73.5, 46.7)
assert (example["turnIn"]["x"], example["turnIn"]["y"]) == (73.6, 46.8)
assert {obj["id"] for obj in example["objectiveFacts"]} == {48, 203}
print(f"PASS: {len(ids)} unique, ordered quest IDs; source links, coordinate provenance and fixture checked.")
