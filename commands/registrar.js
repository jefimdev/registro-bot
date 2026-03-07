const { SlashCommandBuilder } = require("discord.js");
const registroService = require("../services/registroService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("registrar")
    .setDescription("Abrir registro"),

  async execute(interaction) {

    if (interaction.channelId !== process.env.REGISTRO_CHANNEL_ID)
      return interaction.reply({ content: "❌ Use no canal correto.", ephemeral: true });

    if (registroService.existe(interaction.user.id))
      return interaction.reply({ content: "⚠️ Você já possui registro aberto.", ephemeral: true });

    return interaction.reply({ content: "📋 Registro iniciado.", ephemeral: true });
  }
};