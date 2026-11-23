local _, ns = ...
-- Lua 5.1 without the game/LuaJIT bit library. All masks here are nonnegative.
local function band(a,b)
  local n,p=0,1
  while a>0 and b>0 do
    if a%2==1 and b%2==1 then n=n+p end
    a,b,p=math.floor(a/2),math.floor(b/2),p*2
  end
  return n
end
ns.Bits=bit or bit32 or {band=band,bor=function(a,b)return a+b-band(a,b)end,lshift=function(a,b)return a*2^b end}

