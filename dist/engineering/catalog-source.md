# Quest catalog sources

Data from [ForeverDB.net](https://foreverdb.net). The local catalog joins two reference indexes by numeric quest ID. World routing and player progression have separate sources.

| Source | Pinned coverage | Interpretation |
|---|---|---|
| ForeverDB-only snapshot | 3,862 quests indexed on 2 November 2026 at 06:46 UTC, client 1.60.1.70707. The provider metadata counted 6,614 quests. Its list endpoint returned 3,862. | 1,071 quest rows marked Forever-sourced and 2,791 marked Classic-sourced. Each giver and turn-in location has independent provenance. [Mirror readme](https://github.com/tyler3497/forever-quests/blob/9f4c5aac2d077854d7f4a2bdc2f8eceb8d7b23af/foreverdb/README.md) |
| Compiled catalog v1.3.0 | 4,630 records, published 1 November 2026. Sources include QuestieDB at 8f55e69, a TrinityCore Forever-derived reward data set and NorgannonDB. | Community catalog. Its author identifies 58 referenced-only records and reports no comprehensive live-client verification. [Source manifest](https://github.com/tyler3497/forever-quests/blob/9f4c5aac2d077854d7f4a2bdc2f8eceb8d7b23af/manifest.json) |

The join comprises 4,753 distinct quest IDs. The inputs share 3,739. Another 891 appear only in the compiled catalog and 123 only in the ForeverDB snapshot. A total of 2,794 rows have objective facts and 2,153 have one or more previous relationships in ForeverDB. Both endpoint coordinates are present for 3,432 quest IDs. There are 887 rows with an unknown display zone.

| Endpoint provenance | Giver coordinates | Turn-in coordinates |
|---|---:|---:|
| Player observations in Forever | 826 | 735 |
| Player-reported Forever game map | 0 | 15 |
| Forever client quest marker | 3 | 1 |
| Classic fallback | 2,680 | 2,881 |

## Field meanings

The confidence field preserves the source of the reference row. Values are “forever”, “classic” and “catalog” (supplement-only). Individual character status requires a separate snapshot. The prerequisites and next arrays preserve typed ForeverDB chain links. Their relation and source determine interpretation. “Offered after” reports observations. Multiple prior links may describe alternatives. The catalogFacts object preserves the compiled catalog's preQuestGroup (all) and preQuestSingle (alternatives). Signed IDs and exclusivity retain their source values.

The objectiveFacts array always comes from the compiled catalog in this build. It holds declared creature, item or object IDs, reputation threshold pairs and exploration points with a zone map ID where available. It omits quest prose and unknown counts. Endpoints use zone-map percentages and retain their own source and map ID. A traversable world graph requires independent directed connections, geometry and costs.

For *The Night Watch* (ID 56), the snapshot records Commander Althea Ebonlocke, NPC 264, at (73.5, 46.7) for acceptance and (73.6, 46.8) for turn-in in Duskwood, UiMap 1431. Each coordinate cites Forever observations from two players. The compiled record supplies creature objective IDs 48 and 203. Numerical counts are absent from the structured objective facts. [Quest source](https://foreverdb.net/quest/56-the-night-watch)

## Rebuilding

Run these commands from this directory in Python 3.9 or newer.

    python tools/catalog/build_catalog.py --out dist/data/quests.json
    python tools/catalog/verify_catalog.py dist/data/quests.json

For an offline build, run the builder with the additional argument --checkout PATH_TO_FOREVER_QUESTS. The checkout must contain the four named files from mirror commit 9f4c5aac2d077854d7f4a2bdc2f8eceb8d7b23af. The builder checks normalized SHA-256 for every file before parsing JSON. Reproduction uses publicly posted data and requires no API key. Changing the build requires updating the hashes and reviewing the new coverage.

## Credit and terms

Wherever ForeverDB data is visible, display a link reading “Data from ForeverDB.net”. Its published app rules allow release bundling and specify attribution, key scope and rate limits. They prohibit resale and claiming authorship. The provider identifies Blizzard as the owner of game-client data. This export omits artwork, narrative quest text, maps and audio. [ForeverDB developer terms](https://foreverdb.net/developers)

The compiled catalog is distributed by its authors under GPLv3. Include CATALOG-LICENSE.md, the rebuild program, source revision and these notices with derivatives. QuestieDB documents historical contributions from Questie with incomplete contributor licensing consent. Its file-level terms take precedence. The normalized export includes factual names, numeric relationships and links to the source. [Compiled catalog provenance](https://github.com/tyler3497/forever-quests/tree/9f4c5aac2d077854d7f4a2bdc2f8eceb8d7b23af) · [QuestieDB licensing](https://github.com/Questie/QuestieDB/blob/master/LICENSE.md)
