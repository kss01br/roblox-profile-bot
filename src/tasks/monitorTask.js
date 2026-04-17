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

async function getPlaceDetails(placeId) {
  if (!placeId) return null;

  const url = new URL("https://games.roblox.com/v1/games/multiget-place-details");
  url.searchParams.set("placeIds", String(placeId));

  const res = await fetch(url.toString());

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Erro ${res.status} ao buscar detalhes do place\n${text}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data[0] : null;
}

function getStatusText(type) {
  if (type === 0) return "ficou offline ⚫";
  if (type === 1) return "ficou online 🟢";
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
            player.lastPresenceType !== (presence.userPresenceType ?? null) ||
            player.lastPlaceId !== (presence.placeId ?? null);

          if (changed) {
            const user = await client.users.fetch(discordUserId).catch(() => null);

            let gameName = null;
            let gameLink = null;

            if (presence?.placeId) {
              const placeDetails = await getPlaceDetails(presence.placeId);
              gameName = placeDetails?.name || null;
              gameLink = `https://www.roblox.com/games/${presence.placeId}`;
            }

            if (user) {
              const lines = [
                `🔔 **${player.username}** ${getStatusText(presence.userPresenceType)}`,
                gameName ? `🎮 **Jogo:** ${gameName}` : null,
                gameLink ? `🔗 ${gameLink}` : null,
              ].filter(Boolean);

              await user.send(lines.join("\n")).catch(() => {});
            }

            player.lastGameName = gameName;
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