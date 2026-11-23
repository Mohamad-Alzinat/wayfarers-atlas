# Source review and acceptance evidence

The supplied SRS v1.0, dated 21 November 2026, governs scope. The proposed diagram, sample JSON, sample timings and illustrative layouts describe design options. The three supplied PDFs were read locally. Page references below distinguish PDF pages from printed pages. This note records source findings and evaluation criteria. Test outcomes belong in the execution report.

## Algorithm sources

Harun Kabaca, Ayoub Samir and Savaş Takan, *Benchmarking Atlas: A High-Performance Heuristic for Large-Scale Arc Routing Problems*, 12-page supplied preprint. PDF pp. 3–4, §§3.1–3.3 and Algorithm 1 describe a current-position DFS that temporarily removes back edges, creating an acyclic search region. The extension accumulates unserved value along candidate paths, tracks predecessors and travel cost, and reconstructs a chosen extension. Serviced edges leave the outstanding set. Non-service traversals connect the vehicle to remaining work. Algorithm 1 closes the tour with a shortest return to its depot. Its score mixes required status, endpoint connectivity, value per cost and further routing terms. Caching distances and clearing only touched state are implementation optimizations. The preprint's timing, complexity and benchmark comparisons apply to its method on its reported data. The paper identifies itself as unreviewed.

The Java source and the existing Lua port are independent reference artifacts. Check the coverage sequence on a pinned fixture. Keep any correction opt-in and tested against the original implementation. Attribute the local-DAG/scoring ideas above to the paper separately from code-level facts about the reference.

For website quests, each permission-checked acceptance, remaining counted objective and eligible turn-in is its own required transition over quest state. Travel edges move between physical places. A player can pass the correct place repeatedly while the service remains outstanding. Service consumption requires all relevant in-quest and cross-quest precedences. Progress history makes a required service ineligible for re-consumption. The SRS §9.5 permits an open tour ending at the last completed activity. Specify the actual search horizon, ranking, tie breaking, graph direction and cost units used by the implementation. A dependency DAG of services differs from the paper's DFS-derived local traversal DAG. If that substitution is used, explain it explicitly.

For finite progress, consume at least one new eligible service per planning iteration or fail with blocked service IDs. A greedy extension can cause a dead end on a directed graph where another order succeeds. Distinguish heuristic failure to find a continuation from proof of global infeasibility. Avoid global infeasibility claims unless full-state search establishes them. Dijkstra uses nonnegative modeled seconds; one-use resources require a state dimension. Computing only one cheapest path per stop pair can discard an arrival with more resources that leads to a cheaper complete tour. Bounded exact search must represent all such states or explicitly restrict its supported comparison domain. For the same start, travel permissions, activity set and endpoint rules, percentage gap is 100 × (heuristic cost − exact cost) / exact cost. Suppress it for unsupported, zero-cost or incomparable references.

## Design and architecture sources

Alexander Shvets, *Dive Into Design Patterns* (411-page supplied PDF, printed pp. 51–70). Isolate code by reasons for change. Extend a use case by supplying new implementations. Check result shape, admissible requests and error behavior under substitution. Give consumers the narrow contracts they need. High-level use cases specify the behavior they require from infrastructure.

The Factory Method chapter (printed pp. 74 onward) describes creation delegated to an override in a specialized creator whose client uses a compatible product. Its common creation workflow must actually call the overridable method. Strategy (p. 369 onward) allows distinct algorithms behind one contract. Adapter (p. 150 onward) translates host-specific inputs or representations. Facade (p. 211 onward) exposes a small use-case interface. Chain of Responsibility (p. 251 onward) passes a request along ordered handlers that can stop it. Command (p. 269 onward) encapsulates user intent for an invoker. Observer (p. 337 onward) lets multiple subscribers react to a published change. Test these relationships in a real UI or application workflow.

Harry Percival and Bob Gregory, *Architecture Patterns with Python* (304-page supplied PDF). Ch. 1 gives quests stable identity and places invariants in the domain. Ch. 2 motivates a collection-shaped repository with an in-memory test fake. Ch. 4 extracts use-case orchestration so browser and addon adapters can call it. Ch. 5 favors testing stable use-case behavior. Ch. 8 introduces domain events and delivery to subscribers. Ch. 10 distinguishes a command sent to one handler with an expected outcome from a fact broadcast after a state change. Ch. 13 composes concrete dependencies at application startup and substitutes fakes in tests. These ideas require neither a database nor a distributed broker for a local website.

## Acceptance evidence

The SRS §13.2 requires the following independently demonstrable scenarios.

| ID | Scenario and success condition |
|---|---|
| T-01 | Zero selections produce a successful empty result and a helpful UI. |
| T-02 | One reachable quest yields the correct objective and turn-in order. |
| T-03 | Cross-quest and within-quest predecessors are completed before their dependants. |
| T-04 | Disconnected quest returns a structured error naming affected quests and places. |
| T-05 | A directed transport never supplies an implicit reverse connection. |
| T-06 | Missing portal permission reroutes or explains why a route cannot be generated. |
| T-07 | Single-use travel resources stay consumed across successive legs. |
| T-08 | Every required service is covered on a feasible Atlas fixture. |
| T-09 | Atlas and exact baseline cover the identical fixture with correctly labeled gap. |
| T-10 | A different strategy works through the same facade. |
| T-11 | First validator failure prevents all subsequent checks. |
| T-12 | Optimize, ignore and reset commands cause their expected state changes and events. |
| T-13 | Progress updates the journal, marker and eligibility consistently. |
| T-14 | Pause and resume retain position and modeled time within a documented tolerance. |
| T-15 | Backward seek rebuilds state without duplicate events. |
| T-16 | Mid-leg speed change preserves path position and synchronized ETA. |
| T-17 | Invalid import preserves the existing profile. |
| T-18 | Lua game-compatible and browser runtimes produce matching route and cost on an agreed fixture. |
| T-19 | Mobile viewport exposes planning and playback without horizontal overflow. |
| T-20 | Core functions remain usable with decorative motion disabled. |
| T-21 | Keyboard-only use covers quest selection, optimization, route inspection and playback. |
| T-22 | Capture real target-client evidence for addon loading, quest events and API fields, or mark client verification pending. |

### Requirements easy to miss

- §11.4–5 requires source/version/review/confidence provenance and snapshot preview before replacement. Separate genuine imported progress from later simulation. Bound data sizes and numeric values, reject unknown or duplicate IDs, broken references and prerequisite cycles. Provide recovery for unknown coordinates, including ignoring an unmapped objective.
- FR-001/002/011/012/015 include class, faction, movement speed, hearth status, configurable unlocks and restrictions, zone/status/time filters, zone selection and manual progression/abandon/reset. FR-026/027/040–045 include cumulative ETA, reset/recalculate/hide route, independent map controls and skip-all. FR-050/051 require an interactive explanation of required services.
- MAP-002/003 require normalization per zone and explicit projection, including disconnected portals. MAP-005 forbids invented walking shortcuts across disconnected landmasses. An estimated geometry badge explains a supported connection whose exact polyline is unavailable. A badge cannot turn an unsupported walking edge into valid game data.
- ANIM-001/003/004/005/010 require interpolation along planned geometry using modeled time, an explicit presentation clock multiplier, exact pause/resume behavior, deterministic scheduled events and functional reduced-motion playback. The route is immutable during playback or explicitly invalidated.
- §12.1 defines NFR-001–006 as targets. Publish benchmark conditions and measured data. A 100-marker interaction check, optimization lasting longer than 250 ms, and correct time after speed changes are separate evidence requirements.
- §13.3 permits unverified in-game integration if labeled. §13.4 requests repository revision, supplied requirements, at least one ADR, class diagram, Optimize Route and Quest Completed sequence diagrams, comparison evidence, test output, a website capture and asset attribution. SRS traceability includes GOAL, FR, MAP, ANIM, ALG, NFR and T identifiers.
