const { SlashCommandBuilder } = require("discord.js");
const registroService = require("../services/registroService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("registrar")
    .setDescription("Abrir registro"),

  async execute(interaction, client) {

    if (interaction.channelId !== process.env.REGISTRO_CHANNEL_ID)
      return interaction.reply({ content: "❌ Use no canal correto.", ephemeral: true });

    if (registroService.existe(interaction.user.id))
      return interaction.reply({ content: "⚠️ Você já possui registro aberto.", ephemeral: true });

    const guild = interaction.guild;

    const canal = await guild.channels.create({
      name: `registro-${interaction.user.username}`,
      type: 0,
      parent: process.env.TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
        {
          id: interaction.user.id,
          allow: ["ViewChannel", "SendMessages", "AttachFiles"]
        }
      ]
    });

    registroService.criar(interaction.user.id, canal.id);

    await canal.send("📋 Clique no botão abaixo para preencher seu registro.");

    return interaction.reply({
      content: `✅ Canal criado: <#${canal.id}>`,
      ephemeral: true
    });
  }
};