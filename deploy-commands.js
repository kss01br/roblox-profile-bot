const { REST, Routes } = require("discord.js");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = require("./src/config/env");

const commands = [];
const commandsPath = path.join(__dirname, "src", "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

console.log("Arquivos encontrados:", commandFiles);

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);

  try {
    console.log(`\nLendo arquivo: ${file}`);
    const command = require(filePath);

    console.log("Exportado:", Object.keys(command));

    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
      console.log(`✅ Comando carregado: ${command.data.name}`);
    } else {
      console.log(`⚠️ Comando inválido: ${file}`);
    }
  } catch (error) {
    console.log(`❌ Erro ao carregar ${file}`);
    console.error(error);
  }
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log("\n🚀 Registrando comandos...");
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