const registroService = require("../services/registroService");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  name: "interactionCreate",

  async execute(interaction, client) {

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);
    }

    if (interaction.isButton()) {

      if (!["aprovar", "reprovar"].includes(interaction.customId)) return;

      const registro = registroService.pegar(interaction.user.id);
      if (!registro) return;

      const staff = interaction.member;
      if (!staff.roles.cache.has(process.env.STAFF_ROLE_ID))
        return interaction.reply({ content: "❌ Apenas staff.", ephemeral: true });

      const membro = await interaction.guild.members.fetch(registro.userId);

      if (interaction.customId === "aprovar") {
        await membro.roles.add(process.env.MEMBER_ROLE_ID);
      }

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
        registroService.finalizar(interaction.user.id);
      }, 5000);
    }
  }
};