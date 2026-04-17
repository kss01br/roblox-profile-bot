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

  try {
    const url = new URL("https://games.roblox.com/v1/games/multiget-place-details");
    url.searchParams.set("placeIds", String(placeId));

    const res = await fetch(url.toString());

    if (!res.ok) return null;

    const data = await res.json();
    return Array.isArray(data) ? data[0] : null;
  } catch {
    return null;
  }
}

async function getGameIcon(universeId) {
  if (!universeId) return null;

  try {
    const url = new URL("https://thumbnails.roblox.com/v1/games/icons");
    url.searchParams.set("universeIds", String(universeId));
    url.searchParams.set("returnPolicy", "PlaceHolder");
    url.searchParams.set("size", "512x512");
    url.searchParams.set("format", "Png");
    url.searchParams.set("isCircular", "false");

    const res = await fetch(url.toString());

    if (!res.ok) return null;

    const data = await res.json();
    return data?.data?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
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

          const now = Date.now();
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
          let universeId = null;
          let thumbnailUrl = null;
          let gameLink = null;

          if (newPlaceId) {
            const placeDetails = await getPlaceDetails(newPlaceId);
            gameName = placeDetails?.name || player.lastGameName || "Jogo desconhecido";
            universeId = placeDetails?.universeId || null;
            thumbnailUrl = await getGameIcon(universeId);
            gameLink = `https://www.roblox.com/games/${newPlaceId}`;
          }

          // quando entra em jogo vindo de outro estado
          if (newPresenceType === 2 && player.lastPresenceType !== 2) {
            player.startedPlayingAt = now;
          }

          const previousStartedPlayingAt = player.startedPlayingAt;
          const oldGameName = player.lastGameName || "Jogo anterior desconhecido";

          // anti-spam simples: ignora notificação se acabou de mandar uma há menos de 60s
          if (player.lastNotificationAt && now - player.lastNotificationAt < 60000) {
            player.lastPresenceType = newPresenceType;
            player.lastPlaceId = newPlaceId;
            player.lastOnline = presence.lastOnline ?? null;
            player.lastGameName = gameName;
            player.lastUniverseId = universeId;
            player.lastThumbnailUrl = thumbnailUrl;
            continue;
          }

          const user = await client.users.fetch(discordUserId).catch(() => null);
          if (!user) continue;

          const embed = new EmbedBuilder()
            .setTitle("👁️ Atualização de monitoramento")
            .setTimestamp();

          let components = [];

          // mudou de jogo
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
                  name: "Ficou jogando por",
                  value: formatPlayTime(previousStartedPlayingAt),
                  inline: true,
                },
                {
                  name: "Entrou em",
                  value: gameName || "Jogo desconhecido",
                  inline: false,
                },
                {
                  name: "⏱️ Jogando há",
                  value: "agora mesmo",
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
            player.startedPlayingAt = now;
          }

          // entrou em jogo
          else if (newPresenceType === 2) {
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
                  value: formatPlayTime(player.startedPlayingAt),
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
          }

          // ficou online
          else if (newPresenceType === 1) {
            embed
              .setColor(0x3498db)
              .setDescription(`🟢 **${player.username}** ficou online`);
          }

          // ficou offline
          else if (newPresenceType === 0) {
            embed
              .setColor(0x95a5a6)
              .setDescription(`⚫ **${player.username}** ficou offline`);

            if (player.lastPresenceType === 2 && player.lastGameName) {
              embed.addFields(
                {
                  name: "Último jogo",
                  value: player.lastGameName,
                  inline: false,
                },
                {
                  name: "Ficou jogando por",
                  value: formatPlayTime(previousStartedPlayingAt),
                  inline: true,
                }
              );
            }

            player.startedPlayingAt = null;
          }

          // Studio
          else if (newPresenceType === 3) {
            embed
              .setColor(0x9b59b6)
              .setDescription(`🛠️ **${player.username}** abriu o Studio`);

            player.startedPlayingAt = null;
          }

          if (thumbnailUrl) {
            embed.setThumbnail(thumbnailUrl);
          } else if (player.lastThumbnailUrl) {
            embed.setThumbnail(player.lastThumbnailUrl);
          }

          await user
            .send({
              embeds: [embed],
              components,
            })
            .catch(() => {});

          player.lastNotificationAt = now;
          player.lastPresenceType = newPresenceType;
          player.lastPlaceId = newPlaceId;
          player.lastOnline = presence.lastOnline ?? null;
          player.lastGameName = gameName;
          player.lastUniverseId = universeId;
          player.lastThumbnailUrl = thumbnailUrl;
        }
      }

      update(data);
    } catch (error) {
      console.error("Erro no monitorTask:");
      console.error(error);
    }
  }, 40 * 1000);
};