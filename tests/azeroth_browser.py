"""Run against the local server with Playwright Chromium installed."""
from pathlib import Path
import os
import json
import math
from playwright.sync_api import sync_playwright, expect
url=os.getenv("ATLAS_GAME_URL","http://127.0.0.1:4173/")
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    page=browser.new_page(viewport={"width":1440,"height":900})
    errors=[]
    page.on("pageerror",lambda ex:errors.append(str(ex)))
    page.goto(url)
    expect(page.locator("#stopCount")).to_have_text("6")
    # Compare the visible itinerary with the actual worker results exported by the journal.
    page.locator("#compare").click()
    with page.expect_download() as capture:
        page.locator("#exportRun").click()
    comparison=json.loads(capture.value.path().read_text(encoding="utf-8"))
    results={r["algorithmId"]:r for r in comparison["results"]}
    assert set(results)=={"atlas","exact","nearest"}
    exact=results["exact"]
    assert exact["isProvenOptimal"]
    for method,r in results.items():
        assert r["status"]=="ok" and r["coveredCount"]==r["requiredCount"]==6
        assert math.isclose(r["totalCostSeconds"],sum(leg["seconds"] for leg in r["legs"]))
        assert r["totalCostSeconds"]>=exact["totalCostSeconds"]-1e-8
        print(f'Azeroth {method}: {r["totalCostSeconds"]:.3f} model seconds, gap {r["gap"]:.2f}%')
    page.keyboard.press("Escape")
    atlas=results["atlas"]
    labels=page.locator(".stop > span > small:first-of-type").all_text_contents()
    assert labels==[s["label"] for s in atlas["stops"]]
    eta=page.evaluate("async n=>(await import('./js/view-utils.mjs')).duration(n)",atlas["totalCostSeconds"])
    expect(page.locator("#eta")).to_have_text(eta)
    expect(page.locator("#wholeMap")).to_be_visible()
    assert page.locator(".marker").count()==76
    def all_visible():
        return page.locator("#world").evaluate("""svg=>{const rect=svg.getBoundingClientRect();const t=svg.querySelector('#camera').getScreenCTM();return [[0,0],[1000,800]].every(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(t);return p.x>=rect.left-.1&&p.x<=rect.right+.1&&p.y>=rect.top-.1&&p.y<=rect.bottom+.1})}""")
    assert all_visible()
    page.locator("#zoomIn").click();page.locator("#wholeMap").click()
    assert all_visible()
    page.locator("#expandMap").click()
    expect(page.locator(".mapPanel.expanded")).to_be_visible()
    page.keyboard.press("Escape")
    page.locator("#next").click()
    expect(page.locator("#journeyStatus")).to_contain_text("1 of 6")
    page.locator("#next").click()
    assert page.locator('#routeLines [data-status=reached]').count()>0
    page.locator("#legLog").click()
    expect(page.locator("#modalBody")).to_contain_text("Finished")
    page.keyboard.press("Escape");page.locator("#restart").click()
    expect(page.locator("#journeyStatus")).to_contain_text("0 of 6")
    # Journal presets change the routes and survive reload. Custom remains independent.
    assert page.locator('[data-quest="horde-hammerfall"]').count()==0
    page.get_by_role("button",name="Journal",exact=True).click()
    expect(page.locator("#modal")).not_to_be_visible()
    expect(page.locator("#journalHeading")).to_be_focused()
    page.locator("#travelStyle").click()
    expect(page.locator("#modalTitle")).to_have_text("Travel style")
    expect(page.locator(".styleCard")).to_have_count(3)
    page.screenshot(path=str(Path(__file__).resolve().parents[1]/"docs"/"evidence"/"journal-presets.png"))
    page.locator('[data-style="mixed"]').click()
    expect(page.locator("#styleSummary")).to_contain_text("Mixed travel")
    page.reload();expect(page.locator("#styleSummary")).to_contain_text("Mixed travel")
    page.get_by_role("button",name="Journal",exact=True).click()
    expect(page.locator("#modal")).not_to_be_visible()
    expect(page.locator("#journalHeading")).to_be_focused()
    page.locator("#travelStyle").click()
    expect(page.locator("#modalTitle")).to_have_text("Travel style")
    page.locator('[data-style="foot"]').click()
    expect(page.locator("#stops")).to_contain_text("No permitted connection")
    page.get_by_role("button",name="Journal",exact=True).click()
    expect(page.locator("#modal")).not_to_be_visible()
    expect(page.locator("#journalHeading")).to_be_focused()
    page.locator("#travelStyle").click()
    expect(page.locator("#modalTitle")).to_have_text("Travel style")
    page.locator('[data-style="full"]').click()
    expect(page.locator("#stopCount")).to_have_text("6")
    page.locator("#settings").click();page.locator("#pFaction").select_option("Horde")
    page.get_by_role("button",name="Save character").click()
    expect(page.locator("#selCount")).to_have_text("0")
    expect(page.locator('[data-quest="horde-hammerfall"]')).to_be_visible()
    assert page.locator('[data-quest="alliance-nightwatch"]').count()==0
    page.locator("#search").fill("Northfold Manor")
    expect(page.locator("#questList")).to_contain_text("No matching quests")
    page.locator("#adventure").click();page.locator("#trySample").click()
    page.locator("#search").fill("")
    page.locator("#travelMethods").click();page.locator("#footOnly").click()
    page.get_by_role("button",name="Apply & recalculate").click()
    expect(page.locator("#currentStyle")).to_contain_text("On foot only")
    page.reload();expect(page.locator("#currentStyle")).to_contain_text("On foot only")
    expect(page.locator("#stops")).to_contain_text("No permitted connection")
    page.locator("#travelMethods").click()
    page.locator('[data-profile="boat"]').check()
    page.get_by_role("button",name="Apply & recalculate").click()
    expect(page.locator("#stopCount")).to_have_text("6")
    page.locator("#layers").click();page.locator("#zoneAtlas").click()
    page.locator("#zoneChoice").select_option("1417")
    page.locator("#zoneSearch").fill("Hammerfall")
    assert page.locator('[data-entry="horde-hammerfall"]').count()==0
    page.locator("#zoneChoice").select_option("1431")
    page.locator("#zoneSearch").fill("The Night Watch")
    expect(page.locator("#pointList")).to_contain_text("Commander Althea Ebonlocke")
    page.locator("#closeModal").click()
    page.locator("#search").fill("The Night Watch");page.locator('[data-quest="alliance-nightwatch"]').click()
    expect(page.locator("#modalBody")).to_contain_text("Commander Althea Ebonlocke")
    expect(page.locator("#modalBody")).to_contain_text("73.5, 46.7")
    page.keyboard.press("Escape")
    page.locator("#search").fill("Kobold Camp Cleanup")
    page.locator("[data-quest]").first.click()
    expect(page.locator("#stagePlace")).to_be_visible()
    page.locator("#stagePlace").select_option("stormwind")
    page.locator("#stageAdd").click()
    expect(page.locator("#stops")).to_contain_text("Reach staging point")
    page.locator("#filterBtn").click();page.locator("#deselect").click()
    page.locator(".marker[data-id=ironforge]").focus();page.keyboard.press("Enter")
    page.locator("#here").click()
    expect(page.locator("#stops")).to_contain_text("Arrive at Ironforge")
    page.reload();expect(page.locator("#stops")).to_contain_text("Arrive at Ironforge")
    page.locator("#adventure").click();page.locator("#trySample").click()
    expect(page.locator("#stopCount")).to_have_text("6")
    page.locator("#search").fill("")
    evidence=Path(__file__).resolve().parents[1]/"docs"/"evidence"
    for width,height in [(1440,900),(1024,768),(390,844),(320,740)]:
        page.set_viewport_size({"width":width,"height":height})
        if width<1200:
            page.locator("[data-tab=map]").click();expect(page.locator("#modal")).not_to_be_visible();expect(page.locator("#journalHeading")).to_be_focused()
            expect(page.locator("#world")).to_be_visible()
            expect(page.locator(".journal")).to_be_visible()
        page.locator("#wholeMap").click()
        expect(page.locator(".cityArt image")).to_have_count(8)
        expect(page.locator(".cityName")).to_have_count(8)
        names=page.locator(".localName:not(.revealName)")
        assert names.count()>=8,width
        label_overlaps=page.locator("#markers").evaluate("""markers=>{
          const labels=[...markers.querySelectorAll(".mapLabel:not(.revealName)")];
          return labels.flatMap((label,i)=>{
            const a=label.getBoundingClientRect();
            return labels.slice(i+1).filter(other=>{
              const b=other.getBoundingClientRect();
              return a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
            }).map(other=>[label.textContent,other.textContent]);
          });
        }""")
        assert not label_overlaps,(width,label_overlaps)
        visible_at_start=names.count()
        for _ in range(4):page.locator("#zoomIn").click()
        assert names.count()>visible_at_start,width
        page.locator("#wholeMap").click()
        assert all_visible(),width
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth"),width
        if width in (1440,390):page.screenshot(path=str(evidence/f"azeroth-{width}.png"),full_page=True)
    if os.getenv("AXE_SCRIPT"):
        page.set_viewport_size({"width":1440,"height":900})
        page.route("**/axe-audit.js",lambda route:route.fulfill(path=os.environ["AXE_SCRIPT"],content_type="text/javascript"))
        page.add_script_tag(url="/axe-audit.js")
        audit=page.evaluate("""async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})""")
        assert not audit["violations"],[(v["id"],[n["target"] for n in v["nodes"]]) for v in audit["violations"]]
        print("PASS Azeroth automated accessibility checks",len(audit["passes"]),"passed")
    assert not errors,errors
    print("PASS game catalog, profile persistence, completed legs, rewind, travel-only planning and whole map at 4 sizes")
    browser.close()

