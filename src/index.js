const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { DISCORD_TOKEN } = require("./config/env");
const readyHandler = require("./handlers/ready");
const interactionCreateHandler = require("./handlers/interactionCreate");
const messageCreateHandler = require("./handlers/messageCreate");
const startVoiceXpLoop = require("./handlers/voiceXpLoop");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

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
    startVoiceXpLoop(client);
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

    try {
      if (!interaction.isRepliable()) return;

      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp({
            content: "❌ Ocorreu um erro ao processar este comando.",
            flags: 64,
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: "❌ Ocorreu um erro ao processar este comando.",
            flags: 64,
          })
          .catch(() => {});
      }
    } catch (replyError) {
      console.error("Falha ao responder erro global:");
      console.error(replyError);
    }
  }
});

client.on("messageCreate", async (message) => {
  try {
    await messageCreateHandler(message);
  } catch (error) {
    console.error("Erro no messageCreateHandler:");
    console.error(error);
  }
});

client.on("error", (error) => {
  console.error("Erro no client do Discord:");
  console.error(error);
});

if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN não foi encontrado nas variáveis de ambiente");
  process.exit(1);
}

client.login(DISCORD_TOKEN);