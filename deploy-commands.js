const { REST, Routes } = require("discord.js");
require("dotenv").config();

const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = require("./src/config/env");
const robloxCommand = require("./src/commands/roblox");
const rankingCommand = require("./src/commands/ranking");

const commands = [
  robloxCommand.data.toJSON(),
  rankingCommand.data.toJSON(),
];

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log("Iniciando registro de comandos...");
    console.log("CLIENT_ID:", CLIENT_ID);
    console.log("GUILD_ID:", GUILD_ID);
    console.log("Comandos:", commands.map((cmd) => cmd.name));

    const data = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log(`Sucesso: ${data.length} comando(s) registrado(s).`);
  } catch (error) {
    console.error("Erro ao registrar comandos:");
    console.error(error);
  }
})();