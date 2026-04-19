const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

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

  return (
    entry.xp ||
    entry.totalXp ||
    entry.experience ||
    entry.points ||
    0
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rankingxp")
    .setDescription("Mostra o ranking de XP do servidor"),

  async execute(interaction) {
    try {
      const xpData = readXpData();
      const entries = Object.entries(xpData);

      if (!entries.length) {
        return await interaction.reply({
          content: "Ainda não tem dados de XP salvos.",
          ephemeral: true,
        });
      }

      const ranking = entries
        .map(([userId, data]) => ({
          userId,
          xp: getUserXp(data),
        }))
        .filter((user) => user.xp > 0)
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 10);

      if (!ranking.length) {
        return await interaction.reply({
          content: "Ainda não tem ninguém com XP para mostrar no ranking.",
          ephemeral: true,
        });
      }

      const linhas = await Promise.all(
        ranking.map(async (user, index) => {
          let nome = `Usuário ${user.userId}`;

          try {
            const member = await interaction.guild.members.fetch(user.userId);
            nome = member.displayName;
          } catch {
            try {
              const fetchedUser = await interaction.client.users.fetch(user.userId);
              nome = fetchedUser.username;
            } catch {
              nome = `Usuário ${user.userId}`;
            }
          }

          const medalhas = ["🥇", "🥈", "🥉"];
          const posicao = medalhas[index] || `\`${index + 1}.\``;

          return `${posicao} **${nome}** — ${user.xp.toLocaleString("pt-BR")} XP`;
        })
      );

      const embed = new EmbedBuilder()
        .setTitle("🏆 Ranking de XP")
        .setDescription(linhas.join("\n"))
        .setFooter({
          text: `Top ${ranking.length} jogadores com mais XP`,
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Erro no comando /rankingxp:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Ocorreu um erro ao mostrar o ranking de XP.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "Ocorreu um erro ao mostrar o ranking de XP.",
          ephemeral: true,
        });
      }
    }
  },
};