import { writeFile } from "node:fs/promises";
import { luaRouter } from "../tests/lua-driver.mjs";
const { lua } = await luaRouter();
const data = JSON.parse(
  lua.doStringSync(`
local w=NS.WorldData.build(NS.World)
local r={places={},edges={},quests=NS.QuestData,spells={},masters={}}
for _,t in ipairs(NS.WorldData.teleports) do if t.spell and not t.unconfirmed then r.spells[#r.spells+1]={id=t.spell,name=t.name,class=t.class,faction=t.faction} end end
for i,n in ipairs(w.nodes) do
  if n.kind=="ground" then
    r.places[#r.places+1]={id=n.id,name=n.name,zone=n.zone,continent=n.continent,x=n.x,y=n.y}
  elseif not (NS.WorldData.flightMasterExtra[w.nodes[n.ground].id] or {}).unconfirmed then
    r.masters[#r.masters+1]={id=w.nodes[n.ground].id,faction=n.faction,class=n.class}
  end
  for _,e in ipairs(w.adj[i]) do
    if e.mode~="board" and e.mode~="land" and not e.unconfirmed then
      local a,b=w.nodes[e.from],w.nodes[e.to]
      r.edges[#r.edges+1]={from=w.nodes[a.ground or e.from].id,to=w.nodes[b.ground or e.to].id,mode=e.mode,seconds=w:edgeCost(e,{}),class=e.class,faction=e.faction}
    end
  end
end
return NS.JournalJSON.encode(r)`),
);
for (const p of data.places) {
  const [x, y] =
    p.continent === "ZEP"
      ? [495, 80]
      : p.continent === "EK"
        ? [p.x * 0.1 + 470, (9800 - p.y) * 0.1 + 60]
        : [p.x * 0.1 - 70, (10000 - p.y) * 0.1 + 40];
  p.point = [x, (y * 800) / 1060];
  p.kind = "Mapped location";
}
await writeFile(
  new URL("../dist/data/azeroth.json", import.meta.url),
  JSON.stringify(data),
);
lua.global.close();
