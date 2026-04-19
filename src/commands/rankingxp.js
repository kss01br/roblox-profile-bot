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

      const rankingRaw = entries
        .map(([userId, data]) => ({
          userId,
          xp: getUserXp(data),
        }))
        .filter((user) => user.xp > 0)
        .sort((a, b) => b.xp - a.xp);

      if (!rankingRaw.length) {
        return await interaction.editReply({
          content: "Ainda não tem ninguém com XP para mostrar no ranking.",
        });
      }

      const rankingWithInfo = [];

      for (const user of rankingRaw) {
        const info = await resolveUserInfo(interaction, user.userId);

        if (info.isBot) continue;

        rankingWithInfo.push({
          ...user,
          name: info.name,
          avatar: info.avatar,
          rank: getCurrentRank(user.xp),
        });
      }

      if (!rankingWithInfo.length) {
        return await interaction.editReply({
          content: "Ainda não tem ninguém com XP para mostrar no ranking.",
        });
      }

      const top10 = rankingWithInfo.slice(0, 10);
      const top3 = top10.slice(0, 3);
      const rest = top10.slice(3);

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

      const embeds = [...podiumEmbeds];

      if (rest.length > 0) {
        const restLines = rest.map((user, index) => {
          const realPosition = index + 4;
          return `\`${realPosition}.\` **${user.name}** — ${formatNumber(
            user.xp
          )} XP • ${user.rank.name}`;
        });

        const restEmbed = new EmbedBuilder()
          .setColor(0x7c3aed)
          .setTitle("🏆 Ranking Lunar de XP")
          .setDescription(restLines.join("\n"))
          .setFooter({
            text: `Top ${formatNumber(top10.length)}`,
          })
          .setTimestamp();

        embeds.push(restEmbed);
      }

      await interaction.editReply({
        embeds,
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