const registroService = require("../services/registroService");

module.exports = {
  name: "messageCreate",

  async execute(message, client) {

    if (message.author.bot) return;

    const registro = registroService.pegar(message.author.id);
    if (!registro) return;

    if (message.attachments.size === 0)
      return message.reply("❌ Envie a foto como anexo.");

    const foto = message.attachments.first().url;
    registroService.salvarFoto(message.author.id, foto);

    await message.author.send("📨 Foto recebida! Aguarde aprovação.");
  }
};