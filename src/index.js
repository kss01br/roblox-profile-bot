const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { DISCORD_TOKEN } = require("./config/env");
const readyHandler = require("./handlers/ready");
const interactionCreateHandler = require("./handlers/interactionCreate");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

console.log("readyHandler:", readyHandler);
console.log("interactionCreateHandler:", interactionCreateHandler);
console.log("Arquivos de comando encontrados:", commandFiles);

for (const file of commandFiles) {
  try {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
      console.log(`✅ Comando carregado no bot: ${command.data.name}`);
    } else {
      console.log(`⚠️ Comando inválido, faltando data/execute: ${file}`);
    }
  } catch (error) {
    console.error(`❌ Erro ao carregar comando ${file}:`);
    console.error(error);
  }
}

client.once("clientReady", async () => {
  try {
    await readyHandler(client);
  } catch (error) {
    console.error("Erro no readyHandler:");
    console.error(error);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    await interactionCreateHandler(interaction, client);
  } catch (error) {
    console.error("Erro no interactionCreateHandler:");
    console.error(error);

    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("❌ Ocorreu um erro ao processar este comando.");
      } else {
        await interaction.reply({
          content: "❌ Ocorreu um erro ao processar este comando.",
          ephemeral: true,
        });
      }
    }
  }
});

if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN não foi encontrado nas variáveis de ambiente");
  process.exit(1);
}

client.login(DISCORD_TOKEN);