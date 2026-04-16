const { REST, Routes } = require("discord.js");
const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = require("./config/env");
const robloxCommand = require("./commands/roblox");

const commands = [robloxCommand.data.toJSON()];

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registrando comandos...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("Comandos registrados com sucesso!");
  } catch (error) {
    console.error(error);
  }
})();