const { EmbedBuilder } = require("discord.js");
const { formatDate, formatDateTime } = require("./date");
const { getAccountAge } = require("./accountAge");
const { formatNumber } = require("./formatNumber");

function createRobloxEmbed(profile) {
  const embed = new EmbedBuilder()
    .setTitle(`${profile.name} (${profile.displayName})`)
    .setURL(profile.profileUrl)
    .setThumbnail(profile.avatar)
    .addFields(
      { name: "ID", value: String(profile.id), inline: true },
      { name: "Conta criada", value: formatDate(profile.created), inline: true },
      { name: "Idade da conta", value: getAccountAge(profile.created), inline: true },
      { name: "Amigos", value: formatNumber(profile.friendsCount), inline: true },
      { name: "Status", value: profile.status, inline: true },
      { name: "Último online", value: formatDateTime(profile.lastOnline), inline: true },
      { name: "Bio", value: profile.description || "Sem bio" }
    );

  return embed;
}

module.exports = {
  createRobloxEmbed
};