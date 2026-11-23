# From arc coverage to quest service

## Three distinct references

Savaş Takan's [Java Atlas](https://github.com/savastakan/atlas/tree/1748ccf77aca715ba49963f345f3689b911881e0) labels finite-state-machine transitions individually, including parallel arcs. The adjacency lists index outgoing transition labels. From the current last transition, DFS orders reachable transitions. A relaxation prefers predecessors that add unseen labels. The predecessor chain extends the walk. The Java loop removes the terminal label before its termination check. It can omit coverage. The retained Lua port also guards the no-successor case where the Java array index can be invalid. The original-mode Java output fixtures and optional `keepLast` correction remain in the upstream regression suite. The standalone Java repository is pinned in `reference/README.md` with instructions for checking it out separately.

The Kabaca, Samir and Takan preprint (§3, PDF pp. 3–4) describes required edges, a temporary local DAG, scored path extension, cheapest deadheading and depot closure. Its benchmark results concern its own implementation and instances. Our experiment makes no inference about comparative speed on the paper's datasets.

The inherited Wayfarer's Atlas project separately implements multimodal shortest paths, node-stop ordering, weighted Atlas and postman-style flight coverage. All remain available. Flight coverage is a different objective from completing quests.

## Transformation used by the website

An input is a directed travel graph, a fixed character profile, a start, selected quests, selected remaining objectives, a progress baseline and a strategy ID. `AtlasRoute/journey/planner.lua` constructs **required service transitions**. A service has an ID, location, activity type, predecessor indices and work in seconds. In the implicit product graph its endpoints are (place, covered services, resources used) and (same place, covered services plus this service, same resources). The guard checks predecessors and availability. Driving the avatar through the place consumes no service.

Accepting an available quest unlocks its objectives. An objective represents the remaining count times modeled seconds per item. Turn-in requires all unfinished work and acceptance. Selecting a subset of outstanding objectives suppresses turn-in until all requirements are satisfied. A dependent quest also requires the predecessor's turn-in or its recorded completion. Excluding necessary prerequisite work produces an actionable error.

## Route construction

1. Validate selection, coordinates, prerequisites, transport model and start-state reachability. Build a graph from permitted transport modes. Faction and class gates remain on edges used by the upstream router.
2. Use the upstream Dijkstra search over (location, spent mask). For each unique service location and the start, retain the shortest connector for **each** exact subset of one-use resources consumed. This preserves a more expensive path that saves a hearthstone for a later leg.
3. For Atlas, build a local acyclic search of candidate service transitions. Increasing covered cardinality makes every extension acyclic. Keep up to five lowest-cost feasible alternatives per state, including resource alternatives. Explore at most three distinct new services. Beyond the initial service the lookahead has a 110-second travel-plus-work horizon. Choose the greatest coverage depth, then the lowest summed cost. Equal candidates follow cost, input service index and resource-mask order. Commit the first service from the best chain, mark it covered, and rebuild at its destination. The nearest-neighbor baseline uses depth one.
4. The local DAG is in **service state**, rather than the preprint's DFS-pruned physical road graph. Our beam width, horizon and open endpoint are scenario decisions. A different feasible first choice can yield a better tour. Exactly one required service is consumed per successful outer iteration. A common start-reachability check produces `unreachable` for disconnected work. If a heuristic exhausts its feasible extensions it reports `no_extension`. It supplies no proof that a different order is impossible.
5. Given an order, `Tour.orderCost` finds the least-cost allocation of resources across its legs. The planner walks Dijkstra predecessors to return every travel edge, mode and modeled duration, interleaved with explicit service operations. Each service ID appears exactly once on success. Travel seconds plus work seconds equals the total. Tours end at the last service.

## Exact baseline

`Tour.exact` uses Held–Karp DP over visited services, last service and globally consumed resources. It enumerates every allowed next service and disjoint connector mask. Dijkstra solves each fixed-mask connector exactly for nonnegative weights. Induction on the visited-set size therefore gives the minimum total for the modeled open tour. Work is fixed per remaining service. Exact runs are admitted only through **12 services** and the upstream resource-sensitive budget `2^n n² 3^K ≤ 2^13 · 13² · 3`. Larger requests return a bound error for the exact strategy. All strategies have a 120-service request cap.

The proof assumes static edge weights, deterministic activity times, fixed unlocks and one use per limited resource. Server schedules, stochastic combat, real terrain collision and cooldown recovery are outside this model. Comparisons use the same request. A gap is calculated only against a successful positive-cost exact run. Timing in the worker covers JSON decode, planning and encode with the VM already loaded.

## Journal travel styles

A trip connects the start or previous service location to the next service. On foot removes mount, taxi, vehicles, portals, spells and limited-use transport before Dijkstra runs. Full transport opens ordinary services and class travel subject to eligibility, discoveries, learned spells and equipment. Trips whose reference route uses transport count as eligible. Access walks and on-site activities do not count as separate trips.

For Mixed travel the selected routing strategy first constructs a feasible full-transport order. For each transport-using trip the planner computes a second Dijkstra path from the same origin with only walking enabled. It retains mandatory crossings and assigns remaining transport slots to the trips with the largest modeled time savings. Its target is half of eligible trips rounded up, or more when required for reachability. Walking replacements consume no limited resources. All travel segments, service completion times, playback checkpoints and totals reflect the returned route. The mixed policy fixes the reference order and does not claim global optimality. The itinerary reports the actual number of eligible and transport-using trips. Custom uses the exact method and unlock settings saved by the user.

## Result contract

Successful results contain `status: "ok"`, algorithm and graph version, objective counts, proof flag, continuous ordered `legs`, ordered service `stops`, separate travel/work seconds and total seconds. A service stop identifies its quest, objective, location, work and cumulative end time. A travel leg references its destination service, physical endpoints and supplied geometry. For a magical jump the endpoints and cast time suffice. The browser adapter adds elapsed milliseconds. Empty requests succeed with empty lists and zero cost.

Failures contain `status: "error"`, `code`, a displayable message, uncovered IDs, empty legs/stops and a false proof flag. The failure code distinguishes malformed coordinates, missing prerequisites, unresolved reachability, search bounds and an exhausted heuristic. The application discards a response when the selection revision changes before it arrives.

