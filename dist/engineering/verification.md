# Verification report

## Routing correctness audit · 22 November 2026

The journal uses an Atlas-derived service-order heuristic. The original Java Atlas covers graph edges. These checks exercise each against its own objective.

| Quest strategy | Lowest cost on the 39 feasible inputs | Valid, higher cost | Feasible route missed |
|---|---:|---:|---:|
| Bounded Held–Karp | 39 | 0 | 0 |
| Atlas-derived lookahead | 33 | 6 | 0 |
| Nearest neighbor | 30 | 8 | 1 |

The independent test exhausts a state space consisting of the physical location, completed services and remaining hearthstone use. It relaxes raw travel edges and service actions until no cost improves. It uses its own expected prerequisites and costs. All 48 directed four-location graphs were checked with all three strategies. Nine graphs admitted no complete route. The test checks every returned leg, eligibility, continuity, service order, single-use travel, cumulative ETA, travel time and work time. The one nearest-neighbor miss returned a search failure. These counts describe the deterministic test set. The reproducible solver and fixtures are in `tests/routing-oracle.test.mjs`.

On the default Azeroth sample with full transport, all three strategies covered six services in **1,030.913 modeled seconds**. Chromium checked the journal’s ordered labels and displayed ETA against the planner results exported from the app. The movement preset regression also exercises a two-trip fixture with 180 seconds of travel on foot, 70 with mixed travel and 20 with full transport. The mixed policy changes trips after the ordering search and carries no global optimality claim.

The upstream Java code at commit `1748ccf77aca715ba49963f345f3689b911881e0` was compiled with javac 17.0.21.1. All six freshly generated Java outputs matched their stored fixtures exactly. Lua 5.1 and LuaJIT matched those fixtures too. The unmodified Java-compatible mode omits its final edge on these fixtures. The journal uses a separate implementation that requires all requested services for success.

The open Chinese Postman solver was checked against exhaustive edge-state search on small weighted graphs. Weighted Atlas was checked for continuity, coverage and cost against the exact open postman result. Rural Postman was checked against the exact solver when every edge is required. In the faction flight-network benchmarks, all three coverage methods covered 86 directed Alliance links and 84 Horde links. The rural construction uses round trips to join disconnected required components and can miss a feasible one-way open walk. The weighted benchmark now includes only complete comparable walks in cost ratios and identifies the corrected final-edge variant.

The audit corrected four reproduced behaviors. Legacy quest searches now return a structured failure for impossible orders. Flight coverage excludes cooldown-limited spells and devices from repeatable travel. Westreach sample abilities are scoped to their own map. The journal validates coordinates for outstanding services, so a missing location for an already completed objective no longer blocks turn-in.

**Executed checks.** 31 Node tests passed. All 28 Lua tests passed on each of Lua 5.1 and LuaJIT. Both Chromium workflows passed. Three complete browser-worker result payloads matched both native Lua runtimes. The automated accessibility scan reported zero violations and one item for manual review. The WoW Forever client and actual server travel times were outside this verification.

To reproduce, build the Lua payload with `node tools/build.mjs`, run `node --test tests/*.test.mjs`, then run `tests/run.lua` with Lua 5.1 and LuaJIT. Use the README’s browser and parity commands and the reference instructions for the original Java comparison.

## Earlier verification

Executed on 21 November 2026 on Windows, Intel Core i7-13620H, 16 GB class RAM, Node.js 24.22.3, Chromium headless shell 159.0.8154.6, Python 3.12, Lupa 2.8 and Wasmoon 1.16.0. Local-server tests used bundled assets. No WoW client was available.

## Executed suites

| Check | Result and evidence |
|---|---|
| Unchanged upstream at 33f6e8c | 26 passed under LuaJIT 2.1. Stock Lua 5.1 initially lacked the upstream bit library. [Baseline output](evidence/upstream-regression.txt) |
| Updated addon TOC and existing regression cases | 26 passed under LuaJIT 2.1 and 26 passed under PUC Lua 5.1 with the new bit fallback. Includes six stored Java oracle fixtures and opt-in final-edge correction. The tests used a stubbed addon host. |
| New planner, controller, facade, import, lookahead and contract tests | 28 passed, including the Azeroth domain checks and travel-style cases. Includes a fixture where horizon-three guidance chooses a better first service than nearest, and 180 repeated plans with bounded Lua stack usage. [Node output](evidence/node-run.txt) |
| Cross-runtime route parity | All three algorithms produced identical complete serialized route payloads in the real browser worker, native Lua 5.1 and LuaJIT. Transport edges, service IDs, times and proof metadata were compared; runtime milliseconds were excluded. [Parity evidence](evidence/parity-run.txt) |
| Client capture adapter | A fake quest log with a header, one incomplete quest and counted work was captured on both native runtimes. Missing API capability returned an informative failure. |
| Browser journeys | Sample planning, comparison, keyboard selection, zoom/layers/markers, play/pause, step forward/back, reset, snapshot preview, manual locations, reload, disconnected and empty requests passed. At 1024, 390 and 320 px the tested panels worked without horizontal overflow. Zero uncaught page errors. [Browser run](evidence/browser-run.txt) |
| Accessibility | axe-core 4.10.3 checked the initial desktop workspace against WCAG A/AA tags. 27 checks passed, zero reported violations, one rule required review. Keyboard and reduced-motion paths were exercised separately. Screen-reader testing and full-site WCAG conformance remain unverified. [Audit](evidence/accessibility.json) |

A repeated-plan stress run exposed retained return values on the Wasmoon global stack. The host boundary now restores its original stack top after each synchronous call inside the worker. The regression test exercises long-running journal sessions. The original Lua regression harness is unchanged.

### Reproduce the native regression checks with Lupa

From project root, run these in separate processes because the original harness exits after its report.

```sh
python -c "from lupa.lua51 import LuaRuntime; LuaRuntime().execute('arg={[0]=[[tests/run.lua]]};dofile([[tests/run.lua]])')"
python -c "from lupa.luajit21 import LuaRuntime; LuaRuntime().execute('arg={[0]=[[tests/run.lua]]};dofile([[tests/run.lua]])')"
```

For the optional browser accessibility run, set `AXE_SCRIPT` to the local path of axe-core 4.10.3's `axe.min.js` before running `tests/browser.py`. The test supplies the library to the test browser. The deployed planner has no axe dependency.

## Measured comparison

Two warmups and nine recorded runs per cell, in a local Chromium worker after VM initialization. Median milliseconds measure request decoding, planning and result encoding. The benchmark excludes cold loading and painting. Comparison costs are modeled seconds.

| Selected quests | Strategy | Services covered | Total seconds | Gap to exact | Worker median ms |
|---:|---|---:|---:|---:|---:|
| 3 | Atlas-derived | 6/6 | 606 | 27.04% | 2.1 |
| 3 | Held–Karp | 6/6 | 477 | 0% | 2.1 |
| 3 | Nearest neighbor | 6/6 | 606 | 27.04% | 2.0 |
| 10 | Atlas-derived | 28/28 | 1971 | Unavailable | 4.1 |
| 10 | Nearest neighbor | 28/28 | 1971 | Unavailable | 3.6 |

The three-quest Atlas result contains 522 seconds of travel and 84 seconds of work. The exact result reduces travel to 393 seconds. Both complete the same work. Atlas and nearest happen to agree on these two fixtures. A directed counterexample in `lookahead.test.mjs` demonstrates different first-service choices. No exact search ran for the 28-service request. These latency numbers describe this machine and fixture only. [Raw trials](evidence/benchmark.csv)

## Azeroth update

The game-specific suite covers the 76-place projection, 4,753-quest join, navigation-only services, foot versus mount, flight discoveries, faction-restricted transport, learned class spells, engineering devices and crossing from Ratchet to Booty Bay. The browser suite tests route playback, rewind, staging-only quests, coordinate lookup, journal persistence and full-world visibility at 320, 390, 1024 and 1440 pixels. The benchmark table above uses the Westreach fixture.

The preset fixture produces 180 seconds on foot, 70 seconds in Mixed travel and 20 seconds in Full transport. It checks reconstructed leg times, correct journey totals and a required crossing. Browser checks cover changing faction, clearing incompatible selections and applying presets from Journal.

[Desktop Azeroth planner](evidence/azeroth-1440.png) · [Phone Azeroth planner](evidence/azeroth-390.png)

The cartography regression checks all eight city captions and images at four viewport widths. It checks that visible captions have disjoint bounding boxes and that zooming reveals more village and side-location names. The navigation test opens Journal, verifies that keyboard focus reaches the quest journal, then opens Travel style and exercises all three presets.

## Captured screens

[Desktop workspace](evidence/desktop.png) · [Paused simulated journey](evidence/journey-paused.png) · [Phone workspace](evidence/mobile.png)

## Remaining verification

T-22 requires an installed Forever build, a real quest log and direct observation of load, quest updates, export, reload and turn-in. API stubs and third-party captures cannot establish that result. Live attachment and game movement are outside the browser design. No fresh Java compiler execution, mobile-device frame-rate benchmark, 100-marker stress benchmark, screen-reader session or user study was performed. See [traceability](traceability.md) for partial P1 features and data limitations.

