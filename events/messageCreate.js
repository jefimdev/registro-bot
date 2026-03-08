const registroService = require("../services/registroService");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  name: "messageCreate",

  async execute(message) {

    if (message.author.bot) return;

    const registro = registroService.pegarPorCanal(message.channel.id);
    if (!registro) return;

    if (!registro.foto) {

      if (message.attachments.size === 0)
        return message.reply("❌ Envie a foto como ANEXO.");

      const attachment = message.attachments.first();

      registroService.salvarFoto(message.author.id, {
        url: attachment.url,
        name: attachment.name
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("aprovar")
          .setLabel("✅ Aprovar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("reprovar")
          .setLabel("❌ Reprovar")
          .setStyle(ButtonStyle.Danger)
      );

      await message.channel.send({
        content: `Registro de <@${message.author.id}> pronto para decisão.`,
        components: [row]
      });

      await message.author.send("📨 Foto recebida! Aguarde aprovação.");
    }
  }
};