const { EmbedBuilder } = require("discord.js");

module.exports = async (client) => {

  const canal = await client.channels.fetch(process.env.REGISTRO_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setTitle("📋 PAINEL DE REGISTRO")
    .setDescription("Use /registrar para iniciar.");

  await canal.send({ embeds: [embed] });
};