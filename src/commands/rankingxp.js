const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { getCurrentRank, formatNumber } = require("../utils/xpManager");

const xpFilePath = path.join(__dirname, "..", "data", "xp.json");

function ensureXpFileExists() {
  if (!fs.existsSync(xpFilePath)) {
    fs.mkdirSync(path.dirname(xpFilePath), { recursive: true });
    fs.writeFileSync(xpFilePath, "{}", "utf8");
  }
}

function readXpData() {
  ensureXpFileExists();

  try {
    const raw = fs.readFileSync(xpFilePath, "utf8");
    return JSON.parse(raw || "{}");
  } catch (error) {
    console.error("Erro ao ler xp.json:", error);
    return {};
  }
}

function getUserXp(entry) {
  if (typeof entry === "number") return entry;
  if (!entry || typeof entry !== "object") return 0;

  return entry.xp || entry.totalXp || entry.experience || entry.points || 0;
}

async function resolveUserInfo(interaction, userId) {
  try {
    const member = await interaction.guild.members.fetch(userId);

    return {
      name: member.displayName,
      avatar: member.user.displayAvatarURL({
        extension: "png",
        size: 256,
      }),
      isBot: member.user.bot,
    };
  } catch {
    try {
      const user = await interaction.client.users.fetch(userId);

      return {
        name: user.username,
        avatar: user.displayAvatarURL({
          extension: "png",
          size: 256,
        }),
        isBot: user.bot,
      };
    } catch {
      return {
        name: `Usuário ${userId}`,
        avatar: null,
        isBot: false,
      };
    }
  }
}

function getPodiumStyle(position) {
  if (position === 0) {
    return { medal: "🥇", color: 0xf1c40f, title: "1º Lugar" };
  }

  if (position === 1) {
    return { medal: "🥈", color: 0xbdc3c7, title: "2º Lugar" };
  }

  return { medal: "🥉", color: 0xcd7f32, title: "3º Lugar" };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rankingxp")
    .setDescription("Mostra o ranking de XP do servidor"),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const xpData = readXpData();
      const entries = Object.entries(xpData);

      if (!entries.length) {
        return await interaction.editReply({
          content: "Ainda não tem dados de XP salvos.",
        });
      }

      const fullRankingRaw = entries
        .map(([userId, data]) => ({
          userId,
          xp: getUserXp(data),
        }))
        .filter((user) => user.xp > 0)
        .sort((a, b) => b.xp - a.xp);

      if (!fullRankingRaw.length) {
        return await interaction.editReply({
          content: "Ainda não tem ninguém com XP para mostrar no ranking.",
        });
      }

      const fullRankingWithInfo = [];

      for (const user of fullRankingRaw) {
        const info = await resolveUserInfo(interaction, user.userId);

        if (info.isBot) continue;

        fullRankingWithInfo.push({
          ...user,
          name: info.name,
          avatar: info.avatar,
          rank: getCurrentRank(user.xp),
        });
      }

      if (!fullRankingWithInfo.length) {
        return await interaction.editReply({
          content: "Ainda não tem ninguém com XP para mostrar no ranking.",
        });
      }

      const callerPosition =
        fullRankingWithInfo.findIndex(
          (user) => user.userId === interaction.user.id
        ) + 1;

      const top10 = fullRankingWithInfo.slice(0, 10);
      const top3 = top10.slice(0, 3);

      const rankingLines = top10.map((user, index) => {
        const medalhas = ["🥇", "🥈", "🥉"];
        const posicao = medalhas[index] || `\`${index + 1}.\``;

        return `${posicao} **${user.name}**\n┗ ✨ ${formatNumber(
          user.xp
        )} XP • 🌠 ${user.rank.name}`;
      });

      const mainEmbed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle("🏆 Ranking Lunar de XP")
        .setDescription(rankingLines.join("\n\n"))
        .setThumbnail(
          interaction.guild?.iconURL({
            extension: "png",
            size: 256,
          }) || null
        )
        .addFields({
          name: "📍 Sua posição",
          value:
            callerPosition > 0
              ? `#${formatNumber(callerPosition)} • ${formatNumber(
                  fullRankingWithInfo[callerPosition - 1].xp
                )} XP`
              : "Você ainda não entrou no ranking.",
          inline: false,
        })
        .setFooter({
          text: `${interaction.guild?.name || "Servidor"} • ${formatNumber(
            fullRankingWithInfo.length
          )} jogadores ranqueados`,
        })
        .setTimestamp();

      const podiumEmbeds = top3.map((user, index) => {
        const style = getPodiumStyle(index);

        const embed = new EmbedBuilder()
          .setColor(style.color)
          .setTitle(`${style.medal} ${style.title}`)
          .setDescription(`**${user.name}**`)
          .addFields(
            {
              name: "XP",
              value: `${formatNumber(user.xp)} XP`,
              inline: true,
            },
            {
              name: "Patente",
              value: user.rank.name,
              inline: true,
            }
          );

        if (user.avatar) {
          embed.setThumbnail(user.avatar);
        }

        return embed;
      });

      await interaction.editReply({
        embeds: [...podiumEmbeds, mainEmbed],
      });
    } catch (error) {
      console.error("Erro no comando /rankingxp:", error);

      if (interaction.deferred || interaction.replied) {
        await interaction
          .editReply({
            content: "❌ Ocorreu um erro ao mostrar o ranking de XP.",
            embeds: [],
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: "❌ Ocorreu um erro ao mostrar o ranking de XP.",
          })
          .catch(() => {});
      }
    }
  },
};