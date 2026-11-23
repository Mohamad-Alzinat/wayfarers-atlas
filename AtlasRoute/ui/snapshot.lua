local _, ns = ...
-- Read-only quest-log adapter for clients exposing the Forever 1.60.1 quest API.
local function capture(api)
  if not api or not api.GetNumQuestLogEntries or not api.GetInfo or not api.GetQuestObjectives then
    return nil,"Quest-log capture is unavailable on this client."
  end
  local rows={}
  for i=1,api.GetNumQuestLogEntries() do
    local q=api.GetInfo(i)
    if q and not q.isHeader and q.questID and q.questID>0 then
      local objectives={}
      for j,o in ipairs(api.GetQuestObjectives(q.questID) or {}) do
        objectives[j]={label=o.text or "Objective",count=o.numFulfilled or 0,
          required=o.numRequired or 0,finished=o.finished==true}
      end
      rows[#rows+1]={id=q.questID,title=q.title,ready=q.isComplete==true,objectives=objectives}
    end
  end
  return {schema="wayfarer.questlog/1",capturedAt=time and time() or 0,quests=rows}
end
ns.CaptureQuestLog=capture
local frame=CreateFrame("Frame")
frame:RegisterEvent("QUEST_LOG_UPDATE")
frame:SetScript("OnEvent",function()
  if AtlasRouteDB then
    local snapshot=capture(C_QuestLog)
    if snapshot then AtlasRouteDB.questSnapshot=ns.JournalJSON.encode(snapshot) end
  end
end)
SLASH_WAYFAREREXPORT1="/waexport"
SlashCmdList.WAYFAREREXPORT=function()
  local snap,err=capture(C_QuestLog)
  if not snap then DEFAULT_CHAT_FRAME:AddMessage(err);return end
  local json=ns.JournalJSON.encode(snap)
  AtlasRouteDB.questSnapshot=json
  if not ns.ExportWindow then
    local w=CreateFrame("Frame",nil,UIParent,"BasicFrameTemplateWithInset")
    w:SetSize(450,130);w:SetPoint("CENTER");w:SetFrameStrata("DIALOG")
    w.TitleText:SetText("Wayfarer's Atlas — copy quest snapshot")
    local edit=CreateFrame("EditBox",nil,w,"InputBoxTemplate")
    edit:SetSize(390,32);edit:SetPoint("CENTER");edit:SetAutoFocus(false)
    edit:SetScript("OnEscapePressed",function() w:Hide() end)
    ns.ExportWindow=w;ns.ExportBox=edit
  end
  ns.ExportWindow:Show();ns.ExportBox:SetText(json);ns.ExportBox:SetFocus();ns.ExportBox:HighlightText()
end

