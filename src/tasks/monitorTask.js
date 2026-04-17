const { getAll, update } = require("../utils/monitorStore");

async function fetchPresence(userIds) {
  const res = await fetch("https://presence.roblox.com/v1/presence/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Erro ${res.status} ao buscar presence\n${text}`);
  }

  return res.json();
}

function getStatusText(type) {
  if (type === 0) return "offline ⚫";
  if (type === 1) return "online 🟢";
  if (type === 2) return "entrou em um jogo 🎮";
  if (type === 3) return "abriu o Studio 🛠️";
  return "mudou de status";
}

module.exports = (client) => {
  console.log("🔁 Monitor task iniciada");

  setInterval(async () => {
    try {
      console.log("👁️ Monitor rodando...");

      const data = getAll();

      for (const discordUserId in data) {
        const players = data[discordUserId];
        const ids = players.map((p) => Number(p.robloxUserId)).filter(Boolean);

        if (!ids.length) continue;

        const presenceData = await fetchPresence(ids);

        for (const presence of presenceData.userPresences || []) {
          const player = players.find(
            (p) => Number(p.robloxUserId) === presence.userId
          );

          if (!player) continue;

          const changed =
            player.lastPresenceType !== presence.userPresenceType ||
            player.lastPlaceId !== (presence.placeId ?? null);

          if (changed) {
            const user = await client.users.fetch(discordUserId).catch(() => null);

            if (user) {
              const placeId = presence?.placeId;
              const gameLink = placeId
                ? `https://www.roblox.com/games/${placeId}`
                : null;

              const lines = [
                `🔔 **${player.username}** ${getStatusText(presence.userPresenceType)}`,
              ];

              if (gameLink) {
                lines.push(`🔗 ${gameLink}`);
              }

              await user.send(lines.join("\n")).catch(() => {});
            }
          }

          player.lastPresenceType = presence.userPresenceType ?? null;
          player.lastPlaceId = presence.placeId ?? null;
          player.lastOnline = presence.lastOnline ?? null;
        }
      }

      update(data);
    } catch (error) {
      console.error("Erro no monitorTask:");
      console.error(error);
    }
  }, 30 * 1000);
};