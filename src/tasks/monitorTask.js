const { getAll, update } = require("../utils/monitorStore");

async function fetchPresence(userIds) {
  const res = await fetch("https://presence.roblox.com/v1/presence/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds }),
  });

  return res.json();
}

module.exports = (client) => {
  console.log("🔁 Monitor task iniciada");

  setInterval(async () => {
    try {
      console.log("👁️ Monitor rodando...");

      const data = getAll();

      for (const discordUserId in data) {
        const players = data[discordUserId];
        const ids = players.map((p) => Number(p.robloxUserId));

        if (!ids.length) continue;

        const presenceData = await fetchPresence(ids);

        for (const presence of presenceData.userPresences || []) {
          const player = players.find(
            (p) => Number(p.robloxUserId) === presence.userId
          );

          if (!player) continue;

          const changed =
            player.lastPresenceType !== presence.userPresenceType ||
            player.lastPlaceId !== presence.placeId;

          if (changed) {
            const user = await client.users.fetch(discordUserId);

            let msg = `🔔 ${player.username} `;

            if (presence.userPresenceType === 2) {
              msg += "entrou em um jogo 🎮";
            } else if (presence.userPresenceType === 1) {
              msg += "ficou online 🟢";
            } else if (presence.userPresenceType === 3) {
              msg += "entrou no Studio 🛠️";
            } else {
              msg += "ficou offline ⚫";
            }

            await user.send(msg).catch(() => {});
          }

          player.lastPresenceType = presence.userPresenceType;
          player.lastPlaceId = presence.placeId ?? null;
        }
      }

      update(data);
    } catch (error) {
      console.error("Erro no monitorTask:");
      console.error(error);
    }
  }, 10 * 30 * 1000);
};