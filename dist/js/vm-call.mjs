export function calculateInVM(engine, request) {
  const top = engine.global.getTop();
  try {
    engine.global.set("requestJSON", JSON.stringify(request));
    const start = performance.now();
    const json = engine.doStringSync(
      "return NS.JournalJSON.encode(NS.JourneyPlanner.plan(NS.JournalJSON.decode(requestJSON)))",
    );
    const result = JSON.parse(json);
    result.runtimeMs = performance.now() - start;
    return result;
  } finally {
    // The host owns the Lua return slot. Release it after copying the result to JS.
    engine.global.setTop(top);
  }
}
