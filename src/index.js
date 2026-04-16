const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { DISCORD_TOKEN } = require("./config/env");
const readyHandler = require("./handlers/ready");
const interactionCreateHandler = require("./handlers/interactionCreate");
const robloxCommand = require("./commands/roblox");
const rankingCommand = require("./commands/ranking");

console.log("readyHandler:", readyHandler);
console.log("interactionCreateHandler:", interactionCreateHandler);
console.log("rankingCommand:", rankingCommand);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
client.commands.set(robloxCommand.data.name, robloxCommand);
client.commands.set(rankingCommand.data.name, rankingCommand);

client.once("clientReady", () => {
  readyHandler(client);
});

client.on("interactionCreate", async (interaction) => {
  await interactionCreateHandler(interaction, client);
});

if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN não foi encontrado nas variáveis de ambiente");
  process.exit(1);
}

client.login(DISCORD_TOKEN);