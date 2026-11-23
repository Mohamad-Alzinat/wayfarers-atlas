-- The host supplies a repository projection and a profile. No frame, clock or VM globals.
local _, ns = ...
local Planner = {}
local function errorResult(code, message, ids)
  return {status="error", code=code, message=message, uncoveredRequiredIds=ids or {}, legs={}, stops={}, isProvenOptimal=false}
end

-- Each service is the edge (location, covered) -> (location, covered + id).
-- The 'after' list guards that transition. Counts already completed do not create work.
local function services(req, world)
  local stops, byQuest, final = {}, {}, {}
  local omitted = {}
  for _,id in ipairs(req.omitted or {}) do omitted[id]=true end
  local function add(q,kind,site,work,after,obj)
    local id=q.id.."/"..(obj and obj.id or kind)
    stops[#stops+1]={id=id,quest=q.id,kind=kind,node=world.byId[site],place=site,work=work,
      after=after,objective=obj and obj.id,target=obj and obj.count,
      label=obj and obj.label or (kind=="visit" and (q.waypoint and ("Arrive at "..q.title) or ("Reach staging point for "..q.title))) or ((kind=="accept" and "Accept " or "Turn in ")..q.title)}
    byQuest[q.id][#byQuest[q.id]+1]=#stops
    return #stops
  end
  for _,q in ipairs(req.quests) do
    local state=req.progress[q.id] or {}
    byQuest[q.id]={}
    if q.navigationOnly then
      add(q,"visit",q.giver,1,{})
    elseif not state.turnedIn then
      local base={}
      if not state.accepted then base[1]=add(q,"accept",q.giver,4,{}) end
      local parents,partial={},false
      for _,i in ipairs(base) do parents[#parents+1]=i end
      for _,o in ipairs(q.objectives) do
        local remaining=o.count-((state.counts or {})[o.id] or 0)
        if remaining>0 then
          if omitted[q.id.."/"..o.id] then partial=true
          else parents[#parents+1]=add(q,"objective",o.place,remaining*o.seconds,base,o) end
        end
      end
      if not partial then final[q.id]=add(q,"turnin",q.turnin,5,parents) end
    end
  end
  for _,q in ipairs(req.quests) do
    for _,p in ipairs(q.requires or {}) do
      if not (req.progress[p] or {}).turnedIn then
        if not final[p] then return nil,errorResult("prerequisite","Include and finish "..p.." before "..q.title..".",{q.id,p}) end
        for _,i in ipairs(byQuest[q.id]) do
          -- Each vertex needs its own guards, even when several children share an accept.
          local copy={}
          for _,v in ipairs(stops[i].after) do copy[#copy+1]=v end
          copy[#copy+1]=final[p]; stops[i].after=copy
        end
      end
    end
  end
  return stops
end

local azeroth
local function makeWorld(req)
  if req.graph.version=="azeroth-v1" then
    if not azeroth then
      azeroth=ns.WorldData.build(ns.World)
      function azeroth:allowed(edge,profile)
        local mode=edge.mode
        if mode=="board" or mode=="land" then mode="fly" end
        if mode~="walk" and not profile.methods[mode] then return false end
        if mode=="fly" and profile.flights then
          for _,index in ipairs({edge.from,edge.to}) do
            local node=self.nodes[index]
            if node.ground and not profile.flights[self.nodes[node.ground].id] then return false end
          end
        end
        return ns.World.allowed(self,edge,profile)
      end
    end
    local p=req.profile
    local known=nil
    if p.knownFlights then known={}; for _,id in ipairs(p.knownFlights) do known[id]=true end end
    local spells=nil
    if p.knownSpells then spells={}; for _,id in ipairs(p.knownSpells) do spells[id]=true end end
    return azeroth,{methods=p,flights=known,knows=spells and function(id) return spells[id] end,
      speed=p.mount and 11.2 or 7,class=string.upper(p.class),faction=p.faction,bind=p.hearth,
      hearth=p.hearthReady and p.hearth or nil,items={[18984]=p.ripper,[18986]=p.transporter}}
  end
  local w=ns.World.new()
  local p=req.profile
  for _,loc in ipairs(req.graph.places) do w:addPlace({id=loc.id}) end
  for _,e in ipairs(req.graph.edges) do
    if e.mode=="walk" or p[e.mode] then
      local cost=e.seconds
      if e.mode=="walk" and p.mount then cost=cost/1.6 end
      local edge=w:edge(w:index(e.from),w:index(e.to),e.mode,cost,{faction=e.faction,class=e.class})
      edge.geometry=e.path
    end
  end
  if req.graph.version=="westreach-1" then
    if w.byId.haven and p.teleport and p.class=="Mage" then
      w:addTeleport({to="haven",mode="teleport",cost=8,name="Recall to the inn"})
    end
    if w.byId.mill and p.device then
      w:addTeleport({to="mill",mode="device",cost=9,limited=true,name="Waystone"})
    end
  end
  return w,{speed=1,class=p.class,faction=p.faction,hearth=p.hearthReady and p.hearth or nil}
end

local function available(stops,j,done)
  if done[j] then return false end
  for _,parent in ipairs(stops[j].after) do if not done[parent] then return false end end
  return true
end

-- A local DAG of at most three new coverage transitions. Candidate states strictly
-- increase coverage. Each deadhead is a Dijkstra connector with a disjoint resource mask.
local function guided(M,stops,depth)
  local order,done,spent,at={},{},0,0
  for round=1,#stops do
    local best
    local function extend(origin,used,level,cost,first,firstSpend)
      local alternatives={}
      for j=1,#stops do
        if available(stops,j,done) then
          for c=0,M.S-1 do
            local travel=M.D[origin][j][c+1]
            if ns.Bits.band(used,c)==0 and travel<math.huge then
              alternatives[#alternatives+1]={j=j,c=c,cost=travel+stops[j].work}
            end
          end
        end
      end
      table.sort(alternatives,function(a,b)
        if a.cost~=b.cost then return a.cost<b.cost end
        if a.j~=b.j then return a.j<b.j end
        return a.c<b.c
      end)
      for i=1,math.min(#alternatives,5) do
        local a=alternatives[i]
        local total=cost+a.cost
        local start=first or a.j
        local initial=firstSpend or a.c
        if level==1 or total<=110 then
          if not best or level>best.depth or (level==best.depth and total<best.cost) then
            best={depth=level,cost=total,first=start,spend=initial}
          end
          if level<depth and total<110 then
            done[a.j]=true; extend(a.j,used+a.c,level+1,total,start,initial); done[a.j]=nil
          end
        end
      end
    end
    extend(at,spent,1,0)
    if not best then return nil end
    at=best.first; spent=spent+best.spend; done[at]=true; order[round]=at
  end
  return order
end

-- Factory Method: run() is inherited. Each creator chooses its strategy by overriding
-- createStrategy; the common client accepts independently supplied creator objects.
local Creator={}
function Creator:run(M,stops) return self:createStrategy():calculate(M,stops) end
function Planner.creator(factory)
  return setmetatable({createStrategy=factory},{__index=Creator})
end
local function guidedStrategy(depth)
  return {calculate=function(_,M,s) return guided(M,s,depth) end}
end
Planner.creators={
 atlas=Planner.creator(function() return guidedStrategy(3) end),
 nearest=Planner.creator(function() return guidedStrategy(1) end),
 exact=Planner.creator(function() return {calculate=function(_,M,s) return ns.Tour.exact(M,s) end} end)
}

function Planner.chain(checks)
  local function visit(i,ctx)
    if checks[i] then return checks[i](ctx) or visit(i+1,ctx) end
  end
  return function(ctx) return visit(1,ctx) end
end
local validate=Planner.chain({
 function(c)
   local found={}
   for _,q in ipairs(c.r.quests) do
     if q.faction and q.faction~=c.r.profile.faction then return errorResult("faction",q.title.." requires an "..q.faction.." character.",{q.id}) end
     if found[q.id] then return errorResult("selection","A quest is selected twice.",{q.id}) end
     found[q.id]=true
   end
 end,
 function(c)
   local loc={}
   for _,p in ipairs(c.r.graph.places) do loc[p.id]=true end
   if not loc[c.r.profile.start] then return errorResult("coordinate","Choose a known starting point.") end
   c.locations=loc
 end,
 function(c)
   local has={}
   for _,q in ipairs(c.r.quests) do has[q.id]=true end
   for _,q in ipairs(c.r.quests) do
     for _,id in ipairs(q.requires) do
       if not has[id] and not (c.r.progress[id] or {}).turnedIn then return errorResult("prerequisite","Include prerequisite "..id.." for "..q.title..".",{q.id,id}) end
     end
   end
 end,
 function(c)
   local p=c.r.profile
   if p.hearthReady and not c.locations[p.hearth] then return errorResult("transport","Choose a valid hearthstone bind.") end
   for _,e in ipairs(c.r.graph.edges) do
     if not c.locations[e.from] or not c.locations[e.to] or type(e.seconds)~="number" or e.seconds<0 or e.seconds~=e.seconds or e.seconds==math.huge then return errorResult("graph","Invalid travel connection.") end
   end
   c.world,c.profile=makeWorld(c.r)
 end,
 function(c)
   local err
   c.stops,err=services(c.r,c.world)
   if err then return err end
   for _,s in ipairs(c.stops) do
     if not s.node or not c.locations[s.place] then
       return errorResult("coordinate","Location not available for "..s.label,{s.id})
     end
   end
   if #c.stops>120 then return errorResult("bound","Select at most 120 outstanding services per plan.") end
   c.M=ns.Tour.matrices(c.world,c.profile,c.world:index(c.r.profile.start),c.stops)
   local blocked={}
   for i,s in ipairs(c.stops) do if math.min(unpack(c.M.D[0][i]))==math.huge then blocked[#blocked+1]=s.id end end
   if #blocked>0 then return errorResult("unreachable","No permitted connection to "..table.concat(blocked,", ")..". Change travel unlocks or remove the quest.",blocked) end
 end
})

function Planner.plan(req,creators)
  local request={}
  for k,v in pairs(req) do request[k]=v end
  request.profile=ns.JourneyTravelStyle.profile(req.profile,req.profile.travelPreset)
  req=request
  local c={r=req}
  local err=validate(c); if err then return err end
  local M,stops=c.M,c.stops
  local algo=req.algorithm
  local creator=(creators or Planner.creators)[algo]
  if not creator then return errorResult("strategy","Unknown routing strategy.") end
  if algo=="exact" and (#stops>12 or not ns.Tour.exactAffordable(#stops,M.S)) then
    return errorResult("bound","Exact search exceeds the bounded state budget. Select fewer services.")
  end
  local order={}
  if #stops>0 then order=creator:run(M,stops) end
  if not order or #order~=#stops or not ns.Tour.feasible(order,stops) then
    local ids={}; for _,s in ipairs(stops) do ids[#ids+1]=s.id end
    if algo=="exact" then return errorResult("unreachable","No complete route satisfies these restrictions.",ids) end
    return errorResult("no_extension","This strategy could not finish the route. Try exact search for a small selection or change travel options.",ids)
  end
  local total,spend=ns.Tour.orderCost(M,order,stops)
  if total==math.huge then
    return errorResult("no_extension","The proposed order cannot be reached with the available travel resources.")
  end
  local r={status="ok",algorithmId=algo,isProvenOptimal=algo=="exact",graphVersion=req.graph.version,requiredCount=#stops,
    coveredCount=#order,totalCostSeconds=total,travelSeconds=0,workSeconds=0,legs={},stops={},warnings={"Travel times, road connections and map geometry are estimates."}}
  local prev,elapsed=0,0
  for k,j in ipairs(order) do
    local s=stops[j]
    local res=M.cache[M.pts[prev]]
    local v=ns.Router.sid(M.ctx,s.node,spend[k])
    local reverse={}
    while res.prev[v] do
      local step=res.prev[v]
      local from=ns.Router.decode(M.ctx,step.state)
      local to=ns.Router.decode(M.ctx,v)
      reverse[#reverse+1]={kind="travel",mode=step.edge.mode,from=c.world.nodes[c.world.nodes[from].ground or from].id,to=c.world.nodes[c.world.nodes[to].ground or to].id,methodName=step.edge.name,
        path=step.edge.geometry,seconds=res.dist[v]-res.dist[step.state],stopId=s.id,quest=s.quest}
      v=step.state
    end
    for i=#reverse,1,-1 do
      local leg=reverse[i]; if leg.mode=="board" or leg.mode=="land" then leg.phase=leg.mode;leg.mode="fly" end; if leg.mode=="walk" and req.profile.mount then leg.mode="ride" end
      elapsed=elapsed+leg.seconds; leg.endsAt=elapsed;r.travelSeconds=r.travelSeconds+leg.seconds
      r.legs[#r.legs+1]=leg
    end
    elapsed=elapsed+s.work; r.workSeconds=r.workSeconds+s.work
    r.legs[#r.legs+1]={kind="service",mode=s.kind,from=s.place,to=s.place,seconds=s.work,endsAt=elapsed,stopId=s.id,quest=s.quest,objective=s.objective,target=s.target}
    r.stops[k]={id=s.id,quest=s.quest,kind=s.kind,label=s.label,place=s.place,work=s.work,endsAt=elapsed,objective=s.objective}
    prev=j
  end
  return ns.JourneyTravelStyle.apply(r,req,makeWorld)
end
ns.JourneyPlanner=Planner

