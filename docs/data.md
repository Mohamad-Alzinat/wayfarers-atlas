# Provenance and integration

## Scenario and browser state

The default Azeroth journal reads the pinned quest catalog and the repository world model. The schematic shows all 76 ground locations and projects each flight master onto its ground location. Zone maps retain independent percentage coordinates. Their 7,141 endpoints span 52 map IDs. The 16 curated Classic quests simulate the upstream scenario. Unlinked fieldwork can be browsed and a staging point selected. Arriving there records travel only. See [catalog provenance](catalog-source.md).

The Azeroth profile uses graph version `azeroth-v1` and a separate local journal. Road costs use upstream model yards, a detour factor and 7 or 11.2 yards per second. Transit costs include ride time and expected waiting. Class, faction, discovered flight masters, learned spells, selected items and one-use cooldowns constrain route construction. Unconfirmed beta edges are excluded. Coastlines, road topology and transit time remain estimates.

Westreach Vale contains three fictional zones, nine locations and ten original quests. The reusable catalog records stable IDs, display labels, zone-local normalized coordinates, a source version, date and estimation status. Zone transforms convert local coordinates to shared map units. Directed edges have fixed modeled seconds specified independently of image pixels. Walking time is divided by 1.6 for a mounted character. Sample transit weights include the scenario's allowance for travel and waiting. No schedule or terrain path has been measured in a game client.

A journal stores character configuration, selected quests, omitted objectives, counts and turn-ins. Its schema is `wayfarer.journal/1`, bound to its selected graph version. Import previews validate the schema, timestamps, counts, prerequisites, property names, locations and record limits. The byte limit is 256,000; the nesting limit is 12. No imported script is evaluated. Quest text is escaped for display. State is replaced only after the user confirms. A game log's capture time and original rows are retained separately when simulated progress changes.

Playback reconstructs quest state locally. Changes made by seeking are reversible. **Keep simulated progress** saves completed service events, the last reached location, and consumed one-use abilities into an explicitly labeled simulation baseline. An interrupted travel leg restarts from its last reached location. Full journal reset removes imported records and restores the initial sample.

## Addon export

The read-only adapter checks for the three supported functions on `C_QuestLog`, skips headers and retains independent objective counts and finished flags. Quest completion eligibility and actual turn-in are distinct. A quest disappearing from the log supplies insufficient evidence to infer turn-in. Existing `/ar` manual/sample quests remain separate from imported game records. The addon has no network connector or character movement code.

A published capture on Forever **1.60.1 build 69977 / Interface 16001** found quest records and objective progress available. Native objective-pin coordinates were unavailable through the tested interfaces. Live compatibility for this new adapter is pending. Client updates can change capabilities. [Build-specific evidence](https://github.com/TylerAkins/forever-quest-probe/blob/main/FINDINGS.md) · [Forever quest-log API declarations](https://raw.githubusercontent.com/Gethe/wow-ui-source/forever/Interface/AddOns/Blizzard_APIDocumentationGenerated/QuestLogDocumentation.lua)

`/waexport` creates a `wayfarer.questlog/1` JSON snapshot containing capture time, quest IDs/titles, readiness, and objective text/counts/required/finished. Paste it into Settings, preview and confirm. Client records begin without assigned map destinations. Select an imported quest and assign an explicit **simulation location** for each objective and turn-in. Reopen the details to revise an assignment. If a client reports unfinished work without usable counts, the simulated scenario requires manual interaction. Client ID 900001 in the example file is synthetic.

The teaching map supplies no verified real-world coordinates for imported game objectives. Imported quests can be tracked accurately to the extent of the snapshot fields. Their assigned routes model a hypothetical expedition. For the historical Azeroth network and curated Classic quest sample, choose the original showcase in Field guide. Some upstream placements, beta connections and timings are estimates. Source comments in `AtlasRoute/data/` describe their origin.

## Assets and dependencies

| Material | Source and terms |
|---|---|
| Terrain, highlands panorama, ranger | Original generated illustrations created for this project. No Blizzard art or logo is included. |
| Eight city vignettes | Original generated ink-and-wash miniatures, packaged in a single transparent WebP sprite sheet. The atlas clips a separate cell for each city. They are illustrative interpretations of the locations. |
| Village, camp, bridge, dock and countryside marks | Project-authored SVG cartographic symbols. Local names appear as space permits and more become visible on zoom. |
| Compass rose, map marker design and additional transport glyphs | Project-authored vector artwork. |
| Barlow and Cormorant Garamond | Google Fonts upstream. OFL notices included beside the local font files. |
| Lucide icon subset | lucide-static 0.468.0. ISC and applicable Feather MIT attribution in `dist/assets/Lucide-LICENSE`. |
| Wasmoon | 1.16.0, MIT. Unmodified JS/WASM from its npm distribution. License in `dist/vendor/`. |
| JSON codec | rxi/json.lua v0.1.2, MIT. Namespace assignment added for addon loading. License beside the source. |
| Existing Lua, tests, legacy website and research fixtures | User-designated [Wayfarer's Atlas](https://github.com/tugra8005/wayfarers-atlas/tree/33f6e8c4917510012108d77c884f68286a418dd5). Original author credits and README preserved. No new license is asserted for upstream materials. |
| Original Java algorithm | [Pinned original Atlas](https://github.com/savastakan/atlas/tree/1748ccf77aca715ba49963f345f3689b911881e0). Comparison fixtures and upstream reference instructions preserved. |

All primary website assets are self-hosted. A static server is sufficient offline. The browser saves a local journal and preferences; there is no account, analytics service or player-data upload. The original upstream files retain historical remote dependency references; the deployed legacy entry is rewritten to use the included runtime.

