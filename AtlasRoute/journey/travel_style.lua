-- Presets operate on complete trips between service locations. Keep the fastest
-- feasible reference trip wherever transport is mandatory or saves the most time.
local _, ns = ...
local Style = {}
local methods = {"mount","fly","boat","skyship","zeppelin","tram","portal","teleport","device","hearthReady"}
function Style.profile(base, preset)
  local p = {}
  for k,v in pairs(base) do p[k]=v end
  if preset=="foot" then
    for _,key in ipairs(methods) do p[key]=false end
  elseif preset=="mixed" or preset=="full" then
    for _,key in ipairs({"fly","boat","skyship","zeppelin","tram","portal","teleport"}) do p[key]=true end
    -- Equipment, bind readiness, learned spells and discovered masters stay character-specific.
  end
  return p
end

local function walkingTrip(world, profile, origin, destination, cache, stop)
  local start=world:index(origin)
  local search=cache[start]
  if not search then
    local dist,prev,ctx=ns.Router.search(world,profile,start,false)
    search={dist=dist,prev=prev,ctx=ctx};cache[start]=search
  end
  local state=ns.Router.sid(search.ctx,world:index(destination),0)
  if not search.dist[state] then return nil end
  local reverse={}
  while search.prev[state] do
    local step=search.prev[state]
    local from=ns.Router.decode(search.ctx,step.state)
    local to=ns.Router.decode(search.ctx,state)
    reverse[#reverse+1]={kind="travel",mode="walk",from=world.nodes[from].id,to=world.nodes[to].id,
      path=step.edge.geometry,seconds=search.dist[state]-search.dist[step.state],stopId=stop.id,quest=stop.quest}
    state=step.state
  end
  local legs={}
  for i=#reverse,1,-1 do legs[#legs+1]=reverse[i] end
  return legs
end

function Style.apply(result, req, makeWorld)
  local style=req.profile.travelPreset
  if style~="mixed" and style~="full" and style~="foot" then return result end
  local groups,eligible,mandatory,options={},{},0,{}
  local world,profile,cache=nil,nil,{}
  if style=="mixed" then world,profile=makeWorld({graph=req.graph,profile=Style.profile(req.profile,"foot")}) end
  local index=1
  for i,stop in ipairs(result.stops) do
    local group={legs={},seconds=0}
    groups[i]=group
    while result.legs[index].kind=="travel" do
      local leg=result.legs[index]
      group.legs[#group.legs+1]=leg
      group.seconds=group.seconds+leg.seconds
      if leg.mode~="walk" then group.transport=true end
      index=index+1
    end
    group.service=result.legs[index]; index=index+1
    if group.transport then
      eligible[#eligible+1]=i
      if world then
        local walk=walkingTrip(world,profile,group.legs[1].from,stop.place,cache,stop)
        if walk then
          local seconds=0
          for _,leg in ipairs(walk) do seconds=seconds+leg.seconds end
          options[#options+1]={index=i,walk=walk,saving=seconds-group.seconds}
        else mandatory=mandatory+1 end
      end
    end
  end
  local enabled=#eligible
  if style=="mixed" then
    enabled=math.max(mandatory,math.ceil(#eligible/2))
    table.sort(options,function(a,b)
      if a.saving==b.saving then return a.index<b.index end
      return a.saving>b.saving
    end)
    for rank=enabled-mandatory+1,#options do
      local o=options[rank]; groups[o.index].legs=o.walk
    end
    result.legs={}; result.travelSeconds=0
    local elapsed=0
    for i,g in ipairs(groups) do
      for _,leg in ipairs(g.legs) do
        elapsed=elapsed+leg.seconds;leg.endsAt=elapsed
        result.legs[#result.legs+1]=leg;result.travelSeconds=result.travelSeconds+leg.seconds
      end
      elapsed=elapsed+g.service.seconds;g.service.endsAt=elapsed
      result.legs[#result.legs+1]=g.service;result.stops[i].endsAt=elapsed
    end
    result.totalCostSeconds=elapsed
    result.isProvenOptimal=false
  end
  result.travelStyle={preset=style,eligibleTrips=#eligible,transportTrips=enabled,mandatoryTrips=mandatory}
  return result
end
ns.JourneyTravelStyle=Style

