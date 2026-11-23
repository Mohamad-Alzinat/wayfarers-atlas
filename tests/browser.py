"""Serve dist on port 4173 first. pip install playwright; playwright install chromium --only-shell."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
evidence=root/"docs"/"evidence"
evidence.mkdir(exist_ok=True)
url=os.getenv("ATLAS_URL","http://127.0.0.1:4173/?adventure=westreach")
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    page=browser.new_page(viewport={"width":1440,"height":900},device_scale_factor=1)
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.goto(url)
    expect(page.locator("#stopCount")).to_have_text("6")
    assert page.locator("#routeLines g").count()>0
    page.screenshot(path=str(evidence/"desktop.png"),full_page=True)
    if os.getenv("AXE_SCRIPT"):
        page.route("**/axe-audit.js",lambda route:route.fulfill(path=os.environ["AXE_SCRIPT"],content_type="text/javascript"))
        page.add_script_tag(url="/axe-audit.js")
        audit=page.evaluate("""async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})""")
        report={key:[case["id"] for case in audit[key]] for key in ["violations","passes","incomplete"]}
        (evidence/"accessibility.json").write_text(json.dumps(report,indent=2))
        assert not audit["violations"],report
        print("PASS axe accessibility checks",len(audit["passes"]),"passed,",len(audit["incomplete"]),"manual review")
    # Real worker fixture exported for native-Lua parity, including every edge and service.
    parity=page.evaluate("""async()=>{const {WebLuaBridgeAdapter}=await import('./js/bridge.mjs');
      const {sample,graph,quests}=await import('./js/catalog.mjs');const bridge=new WebLuaBridgeAdapter(),cases=[];
      for(const algorithm of ['atlas','nearest','exact']){const req={...sample(),graph,algorithm,quests:quests.slice(0,3)};
      const result=await bridge.calculate(req);delete result.runtimeMs;cases.push({request:req,result})}return cases}""")
    (evidence/"parity.json").write_text(json.dumps(parity,ensure_ascii=False),encoding="utf8")
    # Route-cost benchmark: 2 warmups and 9 timed calls measured inside the worker.
    bench=page.evaluate("""async()=>{const {WebLuaBridgeAdapter}=await import('./js/bridge.mjs');const {sample,graph,quests}=await import('./js/catalog.mjs');
      const b=new WebLuaBridgeAdapter(),runs=[];for(const [size,algorithm] of [[3,'atlas'],[3,'exact'],[3,'nearest'],[10,'atlas'],[10,'nearest']]){
        for(let i=-2;i<9;i++){const r=await b.calculate({...sample(),graph,algorithm,quests:quests.slice(0,size)});if(r.status!=='ok')throw Error(r.message);
        if(i>=0)runs.push([size,algorithm,i+1,r.runtimeMs,r.totalCostSeconds,r.coveredCount])}}
      return runs}""")
    (evidence/"benchmark.csv").write_text("quests,algorithm,run,worker_ms,total_seconds,services\n"+"\n".join(",".join(map(str,row)) for row in bench)+"\n")
    print("PASS initial route, worker contracts, repeated benchmark",browser.version)
    page.locator("#play").focus();page.keyboard.press("Space")
    expect(page.locator("#play")).to_contain_text("Pause")
    expect(page.locator("#clock")).not_to_have_text("0:00 / 10:06")
    page.locator("#play").click()
    stopped=page.locator("#seek").input_value()
    page.screenshot(path=str(evidence/"journey-paused.png"),full_page=True)
    page.wait_for_timeout(100)
    assert page.locator("#seek").input_value()==stopped
    page.locator("#next").click()
    expect(page.locator("#questList")).to_contain_text("4/4")
    page.locator("#prev").click()
    expect(page.locator("#questList")).to_contain_text("1/4")
    page.locator("#speed").select_option("4")
    page.locator("#restart").click()
    assert float(page.locator("#seek").input_value())==0
    page.locator("#zoomIn").click()
    expect(page.locator("#zoomReadout")).to_have_text("125%")
    page.locator("#layers").click();page.get_by_label("Travel connections",exact=True).check()
    page.locator("#resetMap").click()
    page.locator(".marker[data-id=wood]").focus();page.keyboard.press("Enter")
    expect(page.locator("#mapTip")).to_contain_text("Briarwood Grove");page.locator("#hideTip").click()
    print("PASS playback, backward seek, map keyboard marker, layers and zoom")
    page.locator("#compare").click()
    expect(page.locator("#exportRun")).to_be_visible()
    expect(page.locator("#modalBody")).to_contain_text("Proven model-optimal")
    page.keyboard.press("Escape")
    page.locator("#search").fill("Whispers")
    expect(page.locator(".qrow")).to_have_count(1)
    page.get_by_label("Select Whispers in the Wood",exact=True).focus();page.keyboard.press("Space")
    expect(page.locator("#selCount")).to_have_text("2")
    page.locator("#optimize").focus();page.keyboard.press("Enter")
    expect(page.locator("#stopCount")).to_have_text("4")
    page.locator("#search").fill("")
    page.locator("#settings").click();page.locator("#paste").fill('{"schema":"wrong"}')
    page.locator("#preview").click();expect(page.locator("#previewResult")).to_contain_text("Unsupported")
    expect(page.locator("#confirmImport")).to_have_count(0)
    client={"schema":"wayfarer.questlog/1","capturedAt":1795000000,"quests":[{"id":42,"title":"Courier <log>","ready":False,"objectives":[{"label":"Gather parcels","count":1,"required":3,"finished":False}]}]}
    page.locator("#paste").fill(json.dumps(client));page.locator("#preview").click()
    expect(page.locator("#previewResult")).to_contain_text("1 client quest")
    page.locator("#confirmImport").click();expect(page.locator("#stopCount")).to_have_text("0")
    page.locator("#search").fill("Courier")
    page.get_by_label("Select Courier <log>",exact=True).check();page.locator("#optimize").click()
    expect(page.locator("#stops")).to_contain_text("Location not available")
    page.locator("[data-quest=game-42]").click()
    page.locator('[data-place="game-42/turnin"]').select_option("haven")
    page.locator('[data-place="game-42/objective-0"]').select_option("wood")
    page.keyboard.press("Escape");page.locator("#optimize").click()
    expect(page.locator("#stopCount")).to_have_text("2")
    page.reload();expect(page.locator("#stopCount")).to_have_text("2")
    print("PASS search, selection, comparison, invalid import, client preview, placement, planning and reload")
    page.locator("#adventure").click();page.locator("#trySample").click()
    expect(page.locator("#stopCount")).to_have_text("6")
    page.locator("#filterBtn").click();page.locator("#deselect").click()
    page.locator("#optimize").click();expect(page.locator("#stops")).to_contain_text("Choose quests")
    page.locator("#filterBtn").click();page.get_by_label("Select The Last Ferryman",exact=True).check()
    page.locator("#settings").click();page.get_by_text("Travel abilities and unlocks",exact=True).click()
    page.locator('[data-profile="boat"]').uncheck();page.get_by_text("Save character",exact=True).click()
    expect(page.locator("#stops")).to_contain_text("No permitted connection")
    print("PASS empty and unreachable route recovery states")
    page.locator("#adventure").click();page.locator("#trySample").click();expect(page.locator("#stopCount")).to_have_text("6")
    for w,h in [(1024,768),(390,844),(320,740)]:
        page.set_viewport_size({"width":w,"height":h})
        page.locator("[data-tab=map]").click();expect(page.locator("#modal")).not_to_be_visible()
        expect(page.locator("#optimize")).to_be_visible()
        page.locator("[data-tab=itinerary]").click()
        expect(page.locator("#stops")).to_be_visible()
        page.locator("[data-tab=map]").click();expect(page.locator("#modal")).not_to_be_visible()
        expect(page.locator("#mapCanvas")).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth"),(w,h)
        if w==390:page.screenshot(path=str(evidence/"mobile.png"),full_page=True)
    page.emulate_media(reduced_motion="reduce");page.reload();expect(page.locator("#stopCount")).to_have_text("6")
    page.locator("#morePlay").click();page.locator("#skipAll").click()
    expect(page.locator("#playState")).to_have_text("Complete")
    page.locator("#next").focus();page.keyboard.press("ArrowLeft");expect(page.locator("#playState")).to_have_text("Paused")
    assert errors==[],errors
    print("PASS mobile/tablet width, reduced motion, keyboard journey and zero browser errors")
    browser.close()

