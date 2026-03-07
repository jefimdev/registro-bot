const registroService = require("../services/registroService");
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

module.exports = {
  name: "interactionCreate",

  async execute(interaction, client) {

    /* ===== SLASH ===== */
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);
    }

    /* ===== BOTÃO ABRIR MODAL ===== */
    if (interaction.isButton() && interaction.customId === "abrir_modal") {

      const modal = new ModalBuilder()
        .setCustomId("modal_registro")
        .setTitle("Registro");

      const campos = ["id", "nome", "data", "recrutador"];

      modal.addComponents(
        ...campos.map(c =>
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId(c)
              .setLabel(c.toUpperCase())
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        )
      );

      return interaction.showModal(modal);
    }

    /* ===== MODAL ===== */
    if (interaction.isModalSubmit() && interaction.customId === "modal_registro") {

      registroService.salvarDados(interaction.user.id, {
        id: interaction.fields.getTextInputValue("id"),
        nome: interaction.fields.getTextInputValue("nome"),
        data: interaction.fields.getTextInputValue("data"),
        recrutador: interaction.fields.getTextInputValue("recrutador")
      });

      return interaction.reply({
        content: "📸 Agora envie a FOTO como ANEXO neste canal.",
        flags: 64
      });
    }

    /* ===== APROVAÇÃO ===== */
    if (interaction.isButton() && ["aprovar", "reprovar"].includes(interaction.customId)) {

      if (!interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID))
        return interaction.reply({ content: "❌ Apenas staff.", flags: 64 });

      const registro = registroService.pegar(interaction.message.mentions.users.first()?.id);
      if (!registro) return;

      const membro = await interaction.guild.members.fetch(registro.userId);

      if (interaction.customId === "aprovar")
        await membro.roles.add(process.env.MEMBER_ROLE_ID).catch(() => null);

      const logChannel = await interaction.guild.channels.fetch(process.env.LOG_CHANNEL_ID);

      const embedLog = new EmbedBuilder()
        .setTitle("📋 REGISTRO FINALIZADO")
        .setDescription(
          `ID: ${registro.id}\nNome: ${registro.nome}\nData: ${registro.data}\nRecrutador: ${registro.recrutador}`
        )
        .setImage(registro.foto)
        .setFooter({ text: `Decisão por ${interaction.user.tag}` });

      await logChannel.send({ embeds: [embedLog] });

      await interaction.channel.send("🎉 Registro finalizado. Canal será fechado.");

      setTimeout(async () => {
        await interaction.channel.delete().catch(() => null);
        registroService.finalizar(registro.userId);
      }, 5000);
    }
  }
};