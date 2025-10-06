local testworld = CreateOrLoadWorld("savedworld/testworld", "flatworld")
AddEventListener("onPlayerJoin", function(player)
    local playerEntity = GetPlayerEntity(player)
    SetEntityInWorld(playerEntity, testworld)
    SetEntityCoords(playerEntity, vec3(0, 50, 0)) -- Centre du monde
end)
