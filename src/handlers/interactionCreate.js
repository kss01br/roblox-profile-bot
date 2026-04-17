module.exports = async (interaction, client) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.log(`Comando não encontrado: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Erro ao executar o comando ${interaction.commandName}:`, error);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "❌ Deu erro ao executar o comando.",
        });
      } else {
        await interaction.reply({
          content: "❌ Deu erro ao executar o comando.",
          ephemeral: true,
        });
      }
    } catch (replyError) {
      console.error("Erro ao responder a interação após falha:", replyError);
    }
  }
};