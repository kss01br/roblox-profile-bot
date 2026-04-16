const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const maps = require("../data/maps");

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
    throw new Error(`Erro ${response.status} em ${url}`);
  }

  return response.json();
}

async function getPlaceDetails(placeIds) {
  const chunks = chunkArray(placeIds, 50);
  const allDetails = [];

  for (const chunk of chunks) {
    const url = new URL("https://games.roblox.com/v1/games/multiget-place-details");
    url.searchParams.set("placeIds", chunk.join(","));

    const data = await fetchJson(url.toString());

    if (Array.isArray(data)) {
      allDetails.push(...data);
    }
  }

  return allDetails;
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
        .setMaxValue(18)
    ),

  async execute(interaction) {
    const top = interaction.options.getInteger("top") ?? 10;

    await interaction.deferReply();

    try {
      const placeIds = maps.map((map) => map.placeId);
      const placeDetails = await getPlaceDetails(placeIds);

      const placeDetailsByPlaceId = new Map(
        placeDetails.map((item) => [Number(item.placeId), item])
      );

      const mapsWithUniverse = maps
        .map((map) => {
          const detail = placeDetailsByPlaceId.get(Number(map.placeId));
          const universeId =
            detail?.universeId ??
            detail?.universeID ??
            detail?.gameUniverseId ??
            null;

          return {
            ...map,
            universeId: universeId ? Number(universeId) : null,
          };
        })
        .filter((map) => map.universeId);

      if (!mapsWithUniverse.length) {
        return interaction.editReply("Não consegui converter os placeIds em universeIds.");
      }

      const universeIds = mapsWithUniverse.map((map) => map.universeId);
      const gameStats = await getUniverseStats(universeIds);

      const statsByUniverseId = new Map(
        gameStats.map((game) => [Number(game.id), game])
      );

      const ranking = mapsWithUniverse
        .map((map) => {
          const stats = statsByUniverseId.get(Number(map.universeId));

          return {
            ...map,
            playing: stats?.playing ?? 0,
            visits: stats?.visits ?? 0,
            favoritedCount: stats?.favoritedCount ?? 0,
            rootPlaceId: stats?.rootPlaceId ?? map.placeId,
          };
        })
        .sort((a, b) => b.playing - a.playing);

      const totalPlayers = ranking.reduce((sum, item) => sum + item.playing, 0);
      const topList = ranking.slice(0, top);

      const description = topList.length
        ? topList
            .map((item, index) => {
              return `**${index + 1}.** ${item.name}\n👥 ${formatNumber(item.playing)} jogando agora\n🆔 \`${item.placeId}\``;
            })
            .join("\n\n")
        : "Nenhum mapa encontrado.";

      const embed = new EmbedBuilder()
        .setTitle("🏆 Ranking dos Mapas")
        .setColor(0x5865f2)
        .setDescription(description)
        .addFields(
          {
            name: "Mapas monitorados",
            value: String(ranking.length),
            inline: true,
          },
          {
            name: "Players somados",
            value: formatNumber(totalPlayers),
            inline: true,
          },
          {
            name: "Top exibido",
            value: String(topList.length),
            inline: true,
          }
        )
        .setFooter({
          text: "Ranking por players online no momento",
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Erro ao gerar ranking:", error);
      await interaction.editReply("Erro ao gerar o ranking dos mapas.");
    }
  },
};