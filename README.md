# Wayfarer's Atlas

A local-first quest journal and animated route planner for a World of Warcraft: Forever companion project. Select a quest, press **Optimize Route**, then **Play Journey**. The default Azeroth expedition starts at Menethil Harbor with an Alliance character. **Journal** takes you to your quest list. Its **Travel style** button lets you choose On foot, Mixed travel, or Full transport. **Custom** opens transport methods and individual unlocks. **Whole map** fits the entire world schematic. Open **Layers → Browse zone maps** for 7,141 recorded pickup and turn-in endpoints across 52 zone maps. A separate Westreach practice journal remains available in the adventure chooser.

The underlying catalog contains 4,753 distinct game quest IDs. The journal and zone atlas display the character’s faction and shared quests. Catalog records without a confirmed faction stay out of those views. Sixteen curated quests have modeled services on the 76-location travel graph. The other entries expose sourced records and support travel to a staging point. No live-client or complete-server coverage claim is made. [Catalog provenance and counts](docs/catalog-source.md)

**Author:** Mohamad Alzinat · Software engineering coursework for Savaş Takan.

[Design diagrams (PDF)](docs/design-schema.pdf) · [Routing algorithms](docs/algorithms.md) · [Verification report](docs/verification.md)

## Run the website

Use Node.js 20 or later. All application code, Lua modules, fonts, illustrations and the Wasmoon WebAssembly runtime ship in this checkout. No package installation or account is required.

```sh
node tools/build.mjs
node tools/serve.mjs
```

Open **http://127.0.0.1:4173/**. On Windows, double-click **Start Atlas.cmd** to start the server and open the planner. Leave the server running while using the site. Static hosts can serve the contents of `dist/` over HTTP or HTTPS. Opening index.html through a file URL is unsupported because the worker loads local modules over HTTP.

## Guided walkthrough

1. In Azeroth, inspect **James Hyal** and **The Night Watch**. Open **Journal → Travel style** and choose **On foot**. The itinerary explains the blocked crossing. Choose **Mixed travel** to keep the crossing and use transport on approximately half the eligible trips. **Full transport** allows transport for every eligible trip. Each choice recalculates the ETA. Compare the completed and upcoming legs in **Travel log** while playing or seeking. Select a map marker to set your start or add an independent travel stop.
1. To run the following coursework examples, select **Azeroth → Open Westreach practice journal**. The practice sample opens with Elara Windborne and three active quests. Click a journal title to inspect counts, acceptance, turn-in and confidence. Change which quests or objectives are included.
2. Optimize with **Atlas heuristic**. Click a numbered itinerary row to inspect its destination. Open **Layers** to view travel connections or reset the camera.
3. Play, pause, step forward, then step backward over a gathering event. Watch the journal count reverse. Playback options include skipping a leg, following the character and keeping simulated progress.
4. Open **Route comparison**. The standard fixture has six outstanding services. Atlas costs 606 modeled seconds and exact Held–Karp costs 477. Inspect the actual computation time and export the run metadata.
5. Select **Echoes of Moonfall** without **The Watcher's Beacon** and optimize. Use the prerequisite recovery action. To reproduce an unreachable destination, select **The Last Ferryman** and disable ferry access.
6. Open **Field guide** for the interactive service-edge example, engineering diagrams and preserved original Azeroth showcase. The latter includes the existing faction-specific quest tours, point-to-point routing and flight-network coverage algorithms.
7. In **Settings**, export a journal, preview it and confirm the import. Use the supplied **tests/fixtures/questlog-example.json** to demonstrate client-shaped records with unknown locations. Assign locations in quest details, select the imported quest and calculate a hypothetical journey.

## Test commands

```sh
node tools/build.mjs
node --test tests/*.test.mjs
luajit tests/run.lua
lua5.1 tests/run.lua
```

The last two require their respective Lua runtimes. Alternatively run the original harness through Python Lupa as described in [verification](docs/verification.md). Browser and cross-runtime tests are optional development dependencies. With the server running in another terminal:

```sh
python -m pip install playwright==1.65.2 lupa==2.8
python -m playwright install chromium --only-shell
python tests/azeroth_browser.py
python tests/browser.py
python tests/parity.py
```

The browser script captures screenshots, benchmark trials and reference outputs in `docs/evidence/`. The parity test compares full desktop-browser results with native Lua interpreters. The website itself uses no Python packages.

## Companion addon

Copy `AtlasRoute/` into the target installation's `Interface/AddOns/` directory. The TOC targets Forever Interface 16001. The retained `/ar` commands operate on the upstream Azeroth world model. `/waexport` reads the supported quest log and opens a copyable JSON field. Paste its contents in website **Settings → Paste JSON → Preview import**. The addon also stores the serialized snapshot in `AtlasRouteDB.questSnapshot` on quest-log updates. Camera position, quest locations and previous turn-ins are not inferred from missing game fields.

The input shape is based on published build 69977 captures and Forever API definitions. This implementation passed stubbed API tests. Its installation, in-game export window and event delivery still require live-client verification. The web simulation changes only local browser state. See [data and integration](docs/data.md).

## Source layout

| Path | Responsibility |
|---|---|
| `AtlasRoute/core/`, `data/` | Preserved Lua algorithms, Azeroth catalog and portable bit operations |
| `AtlasRoute/journey/` | Shared required-service transformation, validators, strategy creators and planner |
| `AtlasRoute/ui/` | Existing addon UI and capability-checked quest-log adapter |
| `dist/js/` | Browser facade, repository, snapshot validation, worker, playback controller, map and UI |
| `dist/assets/`, `dist/vendor/` | Self-hosted artwork, fonts, icons and Lua runtime |
| `web/`, `reference/`, `tools/` | Upstream showcase, comparison fixtures, original authors' README and development tools |
| `tests/` | Preserved regression suite, new contracts, browser scenarios and parity tests |

## Coursework material

- [Source audit, decisions, diagrams and pattern matrix](docs/architecture.md)
- [Atlas service-edge adaptation and exactness conditions](docs/algorithms.md)
- [Source and data provenance, import contracts and limitations](docs/data.md)
- [Requirement and acceptance traceability](docs/traceability.md)
- [Executed tests, benchmarks and screenshots](docs/verification.md)
- [Project SRS](docs/requirements.md) and [research reading notes](docs/source-review.md)


## Acknowledgments

This project builds on the [Wayfarer's Atlas addon](https://github.com/tugra8005/wayfarers-atlas) and studies [Savaş Takan's original Atlas algorithm](https://github.com/savastakan/atlas).
