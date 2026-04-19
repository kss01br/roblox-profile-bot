const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { DISCORD_TOKEN } = require("./config/env");
const readyHandler = require("./handlers/ready");
const interactionCreateHandler = require("./handlers/interactionCreate");
const messageCreateHandler = require("./handlers/messageCreate");
const startVoiceXpLoop = require("./handlers/voiceXpLoop");

const xpFilePath = path.join(__dirname, "data", "xp.json");
const xpCooldown = new Map();

function ensureXpFileExists() {
  if (!fs.existsSync(xpFilePath)) {
    fs.mkdirSync(path.dirname(xpFilePath), { recursive: true });
    fs.writeFileSync(xpFilePath, "{}", "utf8");
  }
}

function readXpData() {
  ensureXpFileExists();

  try {
    const raw = fs.readFileSync(xpFilePath, "utf8");
    return JSON.parse(raw || "{}");
  } catch (error) {
    console.error("Erro ao ler xp.json:");
    console.error(error);
    return {};
  }
}

function writeXpData(data) {
  ensureXpFileExists();
  fs.writeFileSync(xpFilePath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeUserEntry(entry) {
  if (typeof entry === "number") {
    return {
      xp: entry,
      messages: 0,
      voiceMinutes: 0,
      updatedAt: null,
    };
  }

  if (entry && typeof entry === "object") {
    return {
      xp: entry.xp || 0,
      messages: entry.messages || 0,
      voiceMinutes: entry.voiceMinutes || 0,
      updatedAt: entry.updatedAt || null,
    };
  }

  return {
    xp: 0,
    messages: 0,
    voiceMinutes: 0,
    updatedAt: null,
  };
}

async function handleMessageXp(message) {
  if (!message.guild) return;
  if (message.author.bot) return;

  const content = (message.content || "").trim();

  if (!content) return;
  if (content.startsWith("/")) return;

  const now = Date.now();
  const cooldownTime = 20 * 1000;
  const lastXpTime = xpCooldown.get(message.author.id) || 0;

  if (now - lastXpTime < cooldownTime) return;

  xpCooldown.set(message.author.id, now);

  const xpData = readXpData();
  const gainedXp = Math.floor(Math.random() * 5) + 6; // 6 a 10 XP

  const currentEntry = normalizeUserEntry(xpData[message.author.id]);

  currentEntry.xp += gainedXp;
  currentEntry.messages += 1;
  currentEntry.updatedAt = Date.now();

  xpData[message.author.id] = currentEntry;
  writeXpData(xpData);

  console.log(
    `✅ ${message.author.tag} ganhou ${gainedXp} XP por mensagem. Total: ${currentEntry.xp} | Mensagens: ${currentEntry.messages}`
  );
}

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
    ensureXpFileExists();
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
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: "❌ Ocorreu um erro ao processar este comando.",
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
    await handleMessageXp(message);
  } catch (error) {
    console.error("Erro no handleMessageXp:");
    console.error(error);
  }

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