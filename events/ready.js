const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "clientReady",

  async execute(client) {

    console.log(`🟢 Logado como ${client.user.tag}`);

    const canal = await client.channels.fetch(process.env.REGISTRO_CHANNEL_ID);

    await canal.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("📋 PAINEL DE REGISTRO")
          .setDescription("Use /registrar para iniciar seu registro.")
      ]
    });
  }
};