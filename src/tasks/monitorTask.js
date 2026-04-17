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

function formatPlayTime(startedAt) {
  if (!startedAt) return "agora mesmo";

  const diff = Date.now() - startedAt;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
}

function buildGameButton(placeId) {
  if (!placeId) return [];

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Entrar no jogo")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://www.roblox.com/games/${placeId}`)
    ),
  ];
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

          if (!changed) {
            player.lastOnline = presence.lastOnline ?? null;
            continue;
          }

          let gameName = null;
          let gameLink = null;

          if (newPlaceId) {
            const placeDetails = await getPlaceDetails(newPlaceId);
            gameName = placeDetails?.name || "Jogo desconhecido";
            gameLink = `https://www.roblox.com/games/${newPlaceId}`;
          }

          if (newPresenceType === 2 && player.lastPresenceType !== 2) {
            player.startedPlayingAt = Date.now();
          }

          if (newPresenceType !== 2) {
            player.startedPlayingAt = null;
          }

          const user = await client.users.fetch(discordUserId).catch(() => null);
          if (!user) continue;

          const oldGameName = player.lastGameName || "Jogo anterior desconhecido";
          const playTime = formatPlayTime(player.startedPlayingAt);

          const embed = new EmbedBuilder()
            .setTitle("👁️ Atualização de monitoramento")
            .setTimestamp();

          let components = [];

          if (
            player.lastPresenceType === 2 &&
            newPresenceType === 2 &&
            player.lastPlaceId !== newPlaceId
          ) {
            embed
              .setColor(0xf1c40f)
              .setDescription(`🔄 **${player.username}** mudou de jogo`)
              .addFields(
                {
                  name: "Saiu de",
                  value: oldGameName,
                  inline: false,
                },
                {
                  name: "Entrou em",
                  value: gameName || "Jogo desconhecido",
                  inline: false,
                },
                {
                  name: "⏱️ Jogando há",
                  value: playTime,
                  inline: true,
                }
              );

            if (gameLink) {
              embed.addFields({
                name: "🔗 Link",
                value: gameLink,
                inline: false,
              });
            }

            components = buildGameButton(newPlaceId);
          } else if (newPresenceType === 2) {
            embed
              .setColor(0x57f287)
              .setDescription(`🎮 **${player.username}** entrou em um jogo`)
              .addFields(
                {
                  name: "🎮 Jogo",
                  value: gameName || "Jogo desconhecido",
                  inline: false,
                },
                {
                  name: "⏱️ Jogando há",
                  value: playTime,
                  inline: true,
                }
              );

            if (gameLink) {
              embed.addFields({
                name: "🔗 Link",
                value: gameLink,
                inline: false,
              });
            }

            components = buildGameButton(newPlaceId);
          } else if (newPresenceType === 1) {
            embed
              .setColor(0x3498db)
              .setDescription(`🟢 **${player.username}** ficou online`);
          } else if (newPresenceType === 0) {
            embed
              .setColor(0x95a5a6)
              .setDescription(`⚫ **${player.username}** ficou offline`);

            if (player.lastPresenceType === 2 && player.lastGameName) {
              embed.addFields({
                name: "Último jogo",
                value: player.lastGameName,
                inline: false,
              });
            }
          } else if (newPresenceType === 3) {
            embed
              .setColor(0x9b59b6)
              .setDescription(`🛠️ **${player.username}** abriu o Studio`);
          }

          await user
            .send({
              embeds: [embed],
              components,
            })
            .catch(() => {});

          player.lastPresenceType = newPresenceType;
          player.lastPlaceId = newPlaceId;
          player.lastOnline = presence.lastOnline ?? null;
          player.lastGameName = gameName;
        }
      }

      update(data);
    } catch (error) {
      console.error("Erro no monitorTask:");
      console.error(error);
    }
  }, 30 * 1000);
};