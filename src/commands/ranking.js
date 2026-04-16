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
      const universeIds = maps
        .map((map) => map.universeId || map.placeId)
        .filter(Boolean)
        .map(String);

      if (!universeIds.length) {
        return interaction.editReply("Nenhum ID válido foi encontrado em maps.js.");
      }

      const gameStats = await getUniverseStats(universeIds);

      const statsByUniverseId = new Map(
        gameStats.map((game) => [String(game.id), game])
      );

      const ranking = maps
        .map((map) => {
          const id = String(map.universeId || map.placeId);
          const stats = statsByUniverseId.get(id);

          return {
            ...map,
            playing: stats?.playing ?? 0,
            visits: stats?.visits ?? 0,
            favoritedCount: stats?.favoritedCount ?? 0,
            rootPlaceId: stats?.rootPlaceId ?? map.placeId ?? null,
          };
        })
        .sort((a, b) => b.playing - a.playing);

      const totalPlayers = ranking.reduce((sum, item) => sum + item.playing, 0);
      const topList = ranking.slice(0, top);

      const description = topList.length
        ? topList
            .map((item, index) => {
              const linkPlaceId = item.rootPlaceId || item.placeId || "—";
              const link =
                linkPlaceId !== "—"
                  ? `https://www.roblox.com/games/${linkPlaceId}`
                  : null;

              return [
                `**${index + 1}.** ${item.name}`,
                `👥 ${formatNumber(item.playing)} jogando agora`,
                link ? `🔗 ${link}` : null,
              ]
                .filter(Boolean)
                .join("\n");
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
      console.error("Erro ao gerar ranking:");
      console.error(error);
      await interaction.editReply("Erro ao gerar o ranking dos mapas.");
    }
  },
};