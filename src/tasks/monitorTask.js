const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");
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
  if (type === 0) return "offline ⚫";
  if (type === 1) return "online 🟢";
  if (type === 2) return "entrou em um jogo 🎮";
  if (type === 3) return "abriu o Studio 🛠️";
  return "mudou de status";
}

function formatPlayTime(startedAt) {
  if (!startedAt) return "agora";

  const diff = Date.now() - startedAt;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
}

function buildGameButton(placeId) {
  if (!placeId) return null;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Entrar no jogo")
      .setStyle(ButtonStyle.Link)
      .setURL(`https://www.roblox.com/games/${placeId}`)
  );
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

          const newPresenceType = presence.userPresenceType ?? null;
          const newPlaceId = presence.placeId ?? null;

          const changed =
            player.lastPresenceType !== newPresenceType ||
            player.lastPlaceId !== newPlaceId;

          if (newPresenceType === 2 && player.lastPresenceType !== 2) {
            player.startedPlayingAt = Date.now();
          }

          if (newPresenceType !== 2) {
            player.startedPlayingAt = null;
          }

          if (changed) {
            const user = await client.users.fetch(discordUserId).catch(() => null);

            let gameName = null;
            let gameLink = null;

            if (newPlaceId) {
              const placeDetails = await getPlaceDetails(newPlaceId);
              gameName = placeDetails?.name || null;
              gameLink = `https://www.roblox.com/games/${newPlaceId}`;
            }

            if (user) {
              const oldGameName = player.lastGameName || "Desconhecido";
              const playTime = formatPlayTime(player.startedPlayingAt);

              const embed = new EmbedBuilder()
                .setColor(newPresenceType === 2 ? 0x57f287 : 0x5865f2)
                .setTitle("👁️ Atualização de monitoramento")
                .setTimestamp();

              if (
                player.lastPresenceType === 2 &&
                newPresenceType === 2 &&
                player.lastPlaceId !== newPlaceId
              ) {
                embed.setDescription(`🔄 **${player.username}** mudou de jogo`);
                embed.addFields(
                  {
                    name: "Saiu de",
                    value: player.lastGameName || "Jogo anterior desconhecido",
                    inline: false,
                  },
                  {
                    name: "Entrou em",
                    value: gameName || "Jogo desconhecido",
                    inline: false,
                  },
                  {
                    name: "Tempo no jogo atual",
                    value: playTime,
                    inline: true,
                  }
                );
              } else {
                embed.setDescription(`🔔 **${player.username}** ${getStatusText(newPresenceType)}`);

                if (gameName) {
                  embed.addFields({
                    name: "Jogo",
                    value: gameName,
                    inline: false,
                  });
                }

                if (newPresenceType === 2) {
                  embed.addFields({
                    name: "Tempo jogando",
                    value: playTime,
                    inline: true,
                  });
                }
              }

              const components = [];
              const buttonRow = buildGameButton(newPlaceId);
              if (buttonRow) components.push(buttonRow);

              await user.send({
                embeds: [embed],
                components,
              }).catch(() => {});
            }

            player.lastGameName = gameName;
          }

          player.lastPresenceType = newPresenceType;
          player.lastPlaceId = newPlaceId;
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