"""Compare actual browser captures against both Lua 5.1 and LuaJIT. Requires lupa."""
import json
from pathlib import Path
from lupa import lua51,luajit21
root=Path(__file__).resolve().parents[1]
cases=json.loads((root/"docs/evidence/parity.json").read_text(encoding="utf8"))
for runtime in (lua51,luajit21):
    lua=runtime.LuaRuntime()
    lua.execute('NS={}')
    for module in json.loads((root/"dist/lua/modules.json").read_text(encoding="utf8")):
        lua.globals().source=module["source"]
        lua.execute('assert(loadstring(source))("AtlasRoute",NS)')
    for case in cases:
        lua.globals().request=json.dumps(case["request"])
        result=json.loads(lua.execute("return NS.JournalJSON.encode(NS.JourneyPlanner.plan(NS.JournalJSON.decode(request)))"))
        assert result==case["result"],(runtime,result,case["result"])
    lua.execute('CreateFrame=function()return {RegisterEvent=function()end,SetScript=function()end}end;SlashCmdList={}')
    lua.globals().source=(root/"AtlasRoute/ui/snapshot.lua").read_text(encoding="utf8")
    lua.execute('assert(loadstring(source))("AtlasRoute",NS)')
    lua.execute('''local api={GetNumQuestLogEntries=function()return 2 end,GetInfo=function(i)
        if i==1 then return {isHeader=true} end;return {questID=42,title="Courier",isComplete=false}end,
        GetQuestObjectives=function()return {{text="Gather",numFulfilled=2,numRequired=3,finished=false}}end}
        local log=NS.CaptureQuestLog(api);assert(#log.quests==1 and log.quests[1].objectives[1].count==2)
        local missing,err=NS.CaptureQuestLog({});assert(not missing and err)''')
    print(runtime.__name__,"matches 3 complete browser route payloads; quest-log capability and capture fixtures passed")

