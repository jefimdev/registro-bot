const { SlashCommandBuilder, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const registroService = require("../services/registroService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("registrar")
    .setDescription("Abrir registro"),

  async execute(interaction) {

    if (interaction.channelId !== process.env.REGISTRO_CHANNEL_ID)
      return interaction.reply({ content: "❌ Use no canal correto.", flags: 64 });

    if (registroService.existe(interaction.user.id))
      return interaction.reply({ content: "⚠️ Você já possui registro aberto.", flags: 64 });

    const canal = await interaction.guild.channels.create({
      name: `registro-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: process.env.TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.AttachFiles
          ]
        },
        {
          id: process.env.STAFF_ROLE_ID,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });

    registroService.criar(interaction.user.id, canal.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("abrir_modal")
        .setLabel("📋 Registrar")
        .setStyle(ButtonStyle.Primary)
    );

    await canal.send({
      content: "📋 Clique no botão abaixo para iniciar seu registro.",
      components: [row]
    });

    return interaction.reply({
      content: `✅ Canal criado: <#${canal.id}>`,
      flags: 64
    });
  }
};