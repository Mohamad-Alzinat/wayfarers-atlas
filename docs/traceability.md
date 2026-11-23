# SRS v1.0 traceability

**Implemented** indicates a working feature in the source. **Partial** identifies a scope or verification limit. The acceptance table below records what ran. All geographic and algorithm evidence in the new workspace uses the teaching model unless explicitly labeled as client data.

## Goals

| IDs | Status | Evidence |
|---|---|---|
| GOAL-01, GOAL-02 | Implemented | Editable profile, selectable journal and interactive map. Desktop/mobile evidence. |
| GOAL-03, GOAL-04, GOAL-05 | Implemented | Lua service graph and guarded tour; one controller supplies geometry, service checkpoints and timeline. T-08, T-13–16. |
| GOAL-06, GOAL-07 | Implemented | Architecture matrix and executable contract tests; visible heuristic and model-optimal labels. |
| GOAL-08 | Partial | Versioned client snapshot, capability-tested export, validated browser preview and mapping. Live-client export still needs T-22. |
| GOAL-09, GOAL-10 | Implemented with measured scope | Same-request comparison, runtime and gap; mobile, keyboard and reduced-motion workflows executed. No comprehensive accessibility certification. |

## Functional requirements

| IDs | Status | Implementation and evidence |
|---|---|---|
| FR-001, FR-002, FR-003 | Implemented | Character settings, mount, faction/class, start/bind, cooldown, spells, item and transport gates. `catalog.mjs`, `planner.lua`, T-05–07. |
| FR-004, FR-005 | Implemented | Local journal, simulation/manual/import provenance, explicit reset, settings preferences; browser reload test. |
| FR-010 | Implemented | Quest details expose source, optional reward, known level, IDs, acceptance, objective locations, counts and turn-in. |
| FR-011, FR-012 | Implemented | Search, status/zone/time filtering, selection and undo, select visible by filter. Estimated travel filter calls the same planner. |
| FR-013, FR-014, FR-015 | Implemented | Prerequisite guards, partial counts, distinct turn-in event, manual accept/record/abandon/reset commands. Domain and Lua tests. |
| FR-016, FR-017 | Partial | Imported counts, unknown destinations and explicit manual simulation assignment. No verified Forever quest-location catalog or live-client capture by this project. |
| FR-020, FR-021, FR-022, FR-023, FR-024 | Implemented | Shared Lua stateful Dijkstra, Atlas quest constructor, exact and nearest comparators, structured validation. T-02–11. |
| FR-025, FR-026 | Implemented | Total, work/travel split, method, order, mode and cumulative ETA. Legend identifies estimated geometry. |
| FR-027 | Implemented | Recalculate, reset, undo selection and route layer toggle. |
| FR-028 | Partial | All strategies minimize or heuristically evaluate modeled seconds. Independent physical distance weights are unavailable. |
| FR-029 | Partial | Individual transportation options and profile gates are configurable. Every new-map connection is estimated; no per-edge confidence avoidance. |
| FR-030 | Implemented | Comparison reports cost, work, travel, coverage, runtime and exact-reference gap. |
| FR-040, FR-041 | Implemented | Interactive marker group, transport hubs, closure/zone layers, directional graph and ordered geometry. Mode legend uses strokes and glyphs. |
| FR-042, FR-043, FR-044, FR-045 | Implemented | Fit/reset/focus, stepping/skip/speed, time-indexed service checkpoints and bounded progress events. T-13–16. |
| FR-046, FR-047 | Implemented | Follow, manual override, recenter, portrait and mode badges, boat/flight phase feedback and magical transition. |
| FR-048 | Partial | Exported journal reproduces the starting scenario. Current playback time is transient. |
| FR-050, FR-051, FR-052 | Implemented | Field guide interactive example, original coverage showcase, distinct model proof labels. |
| FR-053, FR-054 | Implemented | JSON comparison export; linked engineering page, source, diagrams and tests. |

## Map, animation and algorithms

| IDs | Status | Implementation and evidence |
|---|---|---|
| MAP-001, MAP-002, MAP-003 | Implemented for sample | Original physical map; stable IDs, zone-local normalized coordinates and affine transform. Imported game coordinates are unknown. |
| MAP-004, MAP-005 | Implemented | Zoom, current zone, numbered stops, restricted network overlay and per-edge modeled path. No pixel-derived ETA. |
| MAP-006 | Partial | Shared locations aggregate multiple services; labels can be toggled. No general zoom-dependent clustering. |
| MAP-007, MAP-008 | Partial | Azeroth exposes the full schematic, source-zone coordinate grids, Whole map, expansion and a time-indexed route with finished/current/upcoming segments and visit markers. Travel log recovers repeated and overlapping passages.  Independent routes, quests, graph, boundaries and labels. Completed segments recolor. Entire Westreach network has estimated confidence; no separate confidence-class overlay or independent completed-segment switch. |
| ANIM-001, ANIM-002, ANIM-003 | Implemented | Time-weighted edge traversal, arc-length position within a polyline, explicit 8:1 presentation scale. |
| ANIM-004, ANIM-005, ANIM-007, ANIM-010 | Implemented | Pausing holds all state; skips/seeks reselect checkpoints. Reduced motion uses discrete positions and suppresses auto-follow. |
| ANIM-006 | Implemented | The direction indicator tracks polyline tangents. Shortest-angle interpolation smooths heading on continuous playback; seeking sets it immediately. |
| ANIM-008, ANIM-009 | Partial | Original ranger portrait with mode badges, service highlight and cast effect. No faction-specific sprite set or particle system. |
| ALG-001, ALG-002, ALG-003, ALG-004, ALG-005 | Implemented | Allowed weighted edges, unique required services, precedence, sum and stop IDs. Common Lua/JS contract tests. |
| ALG-006, ALG-007, ALG-008 | Implemented | Empty success, blocked IDs and common strategy error contract. |
| ALG-009, ALG-010 | Implemented | Unmodified original Atlas port and opt-in correction regression; same-instance exact gap and unsupported-bound handling. |

## Quality and decisions

| IDs | Status | Evidence |
|---|---|---|
| NFR-001 | Measured on supplied fixture | Ten-quest benchmark with nine timed runs after warmup. See verification. |
| NFR-002, NFR-003 | Implemented | Busy message before dispatch, independent worker, stale-result protection. |
| NFR-004 | Partial | Layered SVG, camera group transforms. Nine-location fixture tested; 100-marker performance target unmeasured. |
| NFR-005, NFR-006 | Implemented | Clock and interpolation tested through seek/rate changes; reduced-motion browser flow tested. |
| ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-006 | Documented | See architecture decisions and algorithms. |

## Acceptance tests

| ID | Executed result |
|---|---|
| T-01 | Passed. Empty contract for all strategies and real browser empty state. |
| T-02 | Passed. Single-quest itinerary and correct turn-in. |
| T-03 | Passed. Dependent quest accepted only after predecessor turn-in. |
| T-04 | Passed. Disabling the ferry blocks island services and displays their IDs. |
| T-05 | Passed. The reverse of a one-way portal is unreachable on an isolated fixture. |
| T-06 | Passed. Same portal succeeds for a permitted mage and fails for a hunter. |
| T-07 | Passed. Two required returns, one hearthstone and a known 229-second optimum. |
| T-08 | Passed. All required services covered exactly once on the sample. |
| T-09 | Passed. Actual exact gap and zero-denominator suppression. |
| T-10 | Passed. Same facade and contract exercised against three strategies and injected fakes. |
| T-11 | Passed. Validation chain short-circuit and first-failure checks. |
| T-12 | Passed. Optimize, ignore, reset, mark and selection undo. |
| T-13 | Passed. Journal counter advances only after service; map and itinerary consume the same clock. |
| T-14 | Passed. Pause holds the pose and clock. Resume uses a fresh timestamp. |
| T-15 | Passed. Backward seek restores the initial count; replay does not duplicate service. |
| T-16 | Passed. Rate change mid-leg and interpolated point checked against returned geometry. |
| T-17 | Passed. Malformed/oversized/inconsistent snapshot rejected. Browser preview precedes replacement. |
| T-18 | Passed. All three complete browser route payloads equal native Lua 5.1 and LuaJIT results. |
| T-19 | Passed. 320 and 390 px phones, 1024 px tablet and 1440 px desktop exercised. |
| T-20 | Passed. Reduced-motion phone journey remains operable. |
| T-21 | Passed for tested workflows. Keyboard selection, optimize, marker inspection, step and playback. |
| T-22 | **Unverified.** No running WoW Forever client in the execution environment. Capability stubs and third-party API captures cover a narrower scope. |

