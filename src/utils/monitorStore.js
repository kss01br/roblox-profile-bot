const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "data", "monitor.json");

function read() {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8") || "{}");
}

function write(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function addMonitor(discordUserId, player) {
  const data = read();

  if (!data[discordUserId]) data[discordUserId] = [];

  let list = data[discordUserId];

  // remove duplicado
  list = list.filter((p) => p.robloxUserId !== player.robloxUserId);

  // mantém só 2
  if (list.length >= 2) {
    list.sort((a, b) => a.createdAt - b.createdAt);
    list.shift();
  }

  list.push({
    ...player,
    createdAt: Date.now(),
    lastNotificationAt: 0,
  });

  data[discordUserId] = list;
  write(data);

  return list;
}

function getAll() {
  return read();
}

function update(data) {
  write(data);
}

module.exports = {
  addMonitor,
  getAll,
  update,
};