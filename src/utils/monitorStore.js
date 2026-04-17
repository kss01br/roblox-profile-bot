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

// ➕ adiciona monitor
function addMonitor(discordUserId, player) {
  const data = read();

  if (!data[discordUserId]) data[discordUserId] = [];

  let list = data[discordUserId];

  // remove duplicado
  list = list.filter(
    (p) => p.robloxUserId !== player.robloxUserId
  );

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

// ❌ remove um player específico
function removeMonitor(discordUserId, username) {
  const data = read();

  if (!data[discordUserId]) return [];

  const list = data[discordUserId].filter(
    (p) => p.username.toLowerCase() !== username.toLowerCase()
  );

  data[discordUserId] = list;
  write(data);

  return list;
}

// 🧹 limpa todos
function clearMonitor(discordUserId) {
  const data = read();

  delete data[discordUserId];

  write(data);
}

// 📊 pega tudo
function getAll() {
  return read();
}

// 🔄 atualiza geral
function update(data) {
  write(data);
}

module.exports = {
  addMonitor,
  removeMonitor,
  clearMonitor,
  getAll,
  update,
};