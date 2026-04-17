const { REST, Routes } = require("discord.js");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = require("./src/config/env");

const commands = [];

// pega todos arquivos da pasta commands
const commandsPath = path.join(__dirname, "src", "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(`⚠️ Comando inválido: ${file}`);
  }
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log("🚀 Registrando comandos...");
    console.log("📦 Total:", commands.length);
    console.log("📜 Lista:", commands.map(c => c.name).join(", "));

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ Comandos registrados com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao registrar comandos:");
    console.error(error);
  }
})();