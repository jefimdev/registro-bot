const axios = require("axios");
const { AttachmentBuilder, EmbedBuilder } = require("discord.js");
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

  const registro = registroService.pegarPorCanal(interaction.channel.id);
  if (!registro) return;

  const membro = await interaction.guild.members.fetch(registro.userId);

  if (interaction.customId === "aprovar")
    await membro.roles.add(process.env.MEMBER_ROLE_ID).catch(() => null);

  /* ===== BAIXAR IMAGEM ===== */
  const response = await axios.get(registro.foto.url, {
    responseType: "arraybuffer"
  });

  const file = new AttachmentBuilder(Buffer.from(response.data), {
    name: registro.foto.name
  });

  const embedLog = new EmbedBuilder()
    .setTitle("📋 REGISTRO FINALIZADO")
    .setDescription(
      `ID: ${registro.id}\nNome: ${registro.nome}\nData: ${registro.data}\nRecrutador: ${registro.recrutador}`
    )
    .setImage(`attachment://${registro.foto.name}`)
    .setFooter({ text: `Decisão por ${interaction.user.tag}` });

  const logChannel = await interaction.guild.channels.fetch(process.env.LOG_CHANNEL_ID);

  await logChannel.send({
    embeds: [embedLog],
    files: [file]
  });

  await interaction.channel.send("🎉 Registro finalizado. Canal será fechado.");

  setTimeout(async () => {
    await interaction.channel.delete().catch(() => null);
    registroService.finalizar(interaction.channel.id);
  }, 5000);
}