const registroService = require("../services/registroService");

module.exports = {
  name: "messageCreate",

  async execute(message) {

    if (message.author.bot) return;

    const registro = registroService.pegar(message.author.id);
    if (!registro) return;

    if (!registro.foto) {

      if (message.attachments.size === 0)
        return message.reply("❌ Envie a foto como ANEXO.");

      const foto = message.attachments.first().url;
      registroService.salvarFoto(message.author.id, foto);

      await message.author.send("📨 Foto recebida! Aguarde aprovação.");

      return message.reply("✅ Foto recebida. Staff pode aprovar abaixo.");
    }
  }
};