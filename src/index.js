const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { DISCORD_TOKEN } = require("./config/env");
const readyHandler = require("./handlers/ready");
const interactionCreateHandler = require("./handlers/interactionCreate");
const robloxCommand = require("./commands/roblox");

console.log("readyHandler:", readyHandler);
console.log("interactionCreateHandler:", interactionCreateHandler);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
client.commands.set(robloxCommand.data.name, robloxCommand);

client.once("clientReady", () => {
  readyHandler(client);
});

client.on("interactionCreate", async (interaction) => {
  await interactionCreateHandler(interaction, client);
});

if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN não encontrado no .env");
  process.exit(1);
}

client.login(DISCORD_TOKEN);