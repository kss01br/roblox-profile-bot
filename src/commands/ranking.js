const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const maps = require("../data/maps");

const previousPositions = new Map();

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Erro ${response.status} em ${url}\n${text}`);
  }

  return response.json();
}

async function getUniverseStats(universeIds) {
  const chunks = chunkArray(universeIds, 100);
  const allGames = [];

  for (const chunk of chunks) {
    const url = new URL("https://games.roblox.com/v1/games");
    url.searchParams.set("universeIds", chunk.join(","));

    const data = await fetchJson(url.toString());

    if (Array.isArray(data?.data)) {
      allGames.push(...data.data);
    }
  }

  return allGames;
}

async function getGameIcons(universeIds) {
  const chunks = chunkArray(universeIds, 100);
  const allIcons = [];

  for (const chunk of chunks) {
    const url = new URL("https://thumbnails.roblox.com/v1/games/icons");
    url.searchParams.set("universeIds", chunk.join(","));
    url.searchParams.set("returnPolicy", "PlaceHolder");
    url.searchParams.set("size", "512x512");
    url.searchParams.set("format", "Png");
    url.searchParams.set("isCircular", "false");

    const data = await fetchJson(url.toString());

    if (Array.isArray(data?.data)) {
      allIcons.push(...data.data);
    }
  }

  return allIcons;
}

function getMedal(index) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `#${index + 1}`;
}

function getMovementEmoji(currentIndex, previousIndex) {
  if (previousIndex === undefined) return "🆕";
  if (currentIndex < previousIndex) return "📈";
  if (currentIndex > previousIndex) return "📉";
  return "➖";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ranking")
    .setDescription("Mostra o ranking dos mapas monitorados")
    .addIntegerOption((option) =>
      option
        .setName("top")
        .setDescription("Quantidade de mapas no ranking")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    ),

  async execute(interaction) {
    const top = interaction.options.getInteger("top") ?? 10;

    await interaction.deferReply();

    try {
      const universeIds = maps
        .map((map) => map.universeId)
        .filter(Boolean)
        .map(String);

      if (!universeIds.length) {
        return interaction.editReply("Nenhum universeId válido foi encontrado em maps.js.");
      }

      const [gameStats, gameIcons] = await Promise.all([
        getUniverseStats(universeIds),
        getGameIcons(universeIds),
      ]);

      const statsByUniverseId = new Map(
        gameStats.map((game) => [String(game.id), game])
      );

      const iconsByUniverseId = new Map(
        gameIcons.map((icon) => [String(icon.targetId), icon.imageUrl || null])
      );

      const ranking = maps
        .map((map) => {
          const stats = statsByUniverseId.get(String(map.universeId));

          return {
            ...map,
            playing: stats?.playing ?? 0,
            visits: stats?.visits ?? 0,
            favoritedCount: stats?.favoritedCount ?? 0,
            rootPlaceId: stats?.rootPlaceId ?? map.placeId,
            thumbnailUrl: iconsByUniverseId.get(String(map.universeId)) || null,
          };
        })
        .sort((a, b) => b.playing - a.playing);

      const totalPlayers = ranking.reduce((sum, item) => sum + item.playing, 0);
      const topList = ranking.slice(0, top);

      const embeds = topList.map((item, index) => {
        const previousIndex = previousPositions.get(String(item.universeId));
        const movement = getMovementEmoji(index, previousIndex);
        const medal = getMedal(index);
        const fire = index === 0 ? " 🔥" : "";
        const link = `https://www.roblox.com/games/${item.placeId}`;

        const embed = new EmbedBuilder()
          .setTitle(`${medal} ${item.name}${fire}`)
          .setURL(link)
          .setColor(index === 0 ? 0xff6b00 : 0x5865f2)
          .setDescription(
            [
              `👥 ${formatNumber(item.playing)} jogando agora`,
              `${movement} Movimento no ranking`,
              `❤️ ${formatNumber(item.favoritedCount)} favoritos`,
              `👁️ ${formatNumber(item.visits)} visitas`,
              `🔗 ${link}`,
            ].join("\n")
          )
          .addFields(
            {
              name: "Posição",
              value: String(index + 1),
              inline: true,
            },
            {
              name: "Mapas monitorados",
              value: String(ranking.length),
              inline: true,
            },
            {
              name: "Players somados",
              value: formatNumber(totalPlayers),
              inline: true,
            }
          )
          .setFooter({
            text: `Top ${index + 1} • Ranking por players online no momento`,
          })
          .setTimestamp();

        if (item.thumbnailUrl) {
          embed.setThumbnail(item.thumbnailUrl);
        }

        return embed;
      });

      previousPositions.clear();
      ranking.forEach((item, index) => {
        previousPositions.set(String(item.universeId), index);
      });

      await interaction.editReply({ embeds });
    } catch (error) {
      console.error("Erro ao gerar ranking:");
      console.error(error);
      await interaction.editReply("Erro ao gerar o ranking dos mapas.");
    }
  },
};