require("dotenv").config();
const http = require("http");

/* =========================
   🚀 HEALTH SERVER
========================= */

const http = require("http");

const PORT = process.env.PORT || 8080;

http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end("OK");
}).listen(PORT, "0.0.0.0", () => {
  console.log("🌐 HTTP ativo na porta", PORT);
});

/* =========================
   📦 DISCORD
========================= */

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require("discord.js");

const {
  BOT_TOKEN,
  GUILD_ID,
  LOG_CHANNEL_ID,
  TICKET_CATEGORY_ID,
  MEMBER_ROLE_ID,
  STAFF_ROLE_ID,
  REGISTRO_CHANNEL_ID,
  TIMEOUT_MINUTES
} = process.env;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

/* =========================
   🧠 MEMÓRIA
========================= */

const registros = new Map();
const canaisAbertos = new Map();
const logMessages = new Map();
const timeouts = new Map();

/* =========================
   📝 SLASH
========================= */

async function registerCommands(appId) {
  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(appId, GUILD_ID),
    { body: [{ name: "registrar", description: "Abrir registro" }] }
  );
}

client.once("clientReady", async () => {
  console.log("🟢 Bot online");

  await client.application.fetch();
  await registerCommands(client.application.id);

  // PAINEL FIXO
  const canalRegistro = await client.channels.fetch(REGISTRO_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setTitle("📋 PAINEL DE REGISTRO")
    .setDescription("Use /registrar para iniciar seu registro.");

  await canalRegistro.send({ embeds: [embed] });
});

/* =========================
   🎮 INTERAÇÕES
========================= */

client.on("interactionCreate", async (interaction) => {

  // /registrar
  if (interaction.isChatInputCommand()) {

    if (interaction.channelId !== REGISTRO_CHANNEL_ID)
      return interaction.reply({ content: "❌ Use apenas no canal correto.", ephemeral: true });

    if (canaisAbertos.has(interaction.user.id))
      return interaction.reply({ content: "⚠️ Você já possui registro aberto.", ephemeral: true });

    const guild = await client.guilds.fetch(GUILD_ID);

    const canal = await guild.channels.create({
      name: `registro-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.AttachFiles
          ]
        }
      ]
    });

    canaisAbertos.set(interaction.user.id, canal.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("abrir_modal")
        .setLabel("Registre-se")
        .setStyle(ButtonStyle.Primary)
    );

    await canal.send({ content: "Clique abaixo para registrar-se.", components: [row] });

    return interaction.reply({ content: `✅ Canal criado: <#${canal.id}>`, ephemeral: true });
  }

  // botão abrir modal
  if (interaction.isButton() && interaction.customId === "abrir_modal") {

    const modal = new ModalBuilder()
      .setCustomId("modal_registro")
      .setTitle("Formulário de Registro");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("id").setLabel("ID").setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("nome").setLabel("Nome").setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("data").setLabel("Data").setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("recrutador").setLabel("Recrutador").setStyle(TextInputStyle.Short).setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  // modal enviado
  if (interaction.isModalSubmit()) {

    registros.set(interaction.user.id, {
      id: interaction.fields.getTextInputValue("id"),
      nome: interaction.fields.getTextInputValue("nome"),
      data: interaction.fields.getTextInputValue("data"),
      recrutador: interaction.fields.getTextInputValue("recrutador")
    });

    return interaction.reply({ content: "📸 Agora envie a FOTO como ANEXO.", ephemeral: true });
  }

  // aprovação por botão
  if (interaction.isButton()) {

    if (!["aprovar", "reprovar"].includes(interaction.customId)) return;

    const data = logMessages.get(interaction.message.id);
    if (!data) return;

    const staff = await interaction.guild.members.fetch(interaction.user.id);
    if (!staff.roles.cache.has(STAFF_ROLE_ID))
      return interaction.reply({ content: "❌ Apenas staff pode aprovar.", ephemeral: true });

    const membro = await interaction.guild.members.fetch(data.userId);
    const embed = EmbedBuilder.from(interaction.message.embeds[0]);

    clearTimeout(timeouts.get(interaction.message.id));

    if (interaction.customId === "aprovar") {
      await membro.roles.add(MEMBER_ROLE_ID).catch(() => null);
      embed.setColor("Green").setFooter({ text: `Aprovado por ${staff.user.tag}` });
      await membro.send("🎉 Registro aprovado!");
    } else {
      embed.setColor("Red").setFooter({ text: `Reprovado por ${staff.user.tag}` });
      await membro.send("❌ Registro reprovado.");
    }

    await interaction.update({ embeds: [embed], components: [] });

    const canal = await interaction.guild.channels.fetch(data.channelId).catch(() => null);
    if (canal) await canal.delete().catch(() => null);

    canaisAbertos.delete(data.userId);
    logMessages.delete(interaction.message.id);
  }

});

/* =========================
   📸 FOTO
========================= */

client.on("messageCreate", async (message) => {

  if (!message.guild || message.author.bot) return;

  const reg = registros.get(message.author.id);
  if (!reg) return;

  if (message.attachments.size === 0)
    return message.reply("❌ Envie a foto como ANEXO.");

  const photo = message.attachments.first();

  const embed = new EmbedBuilder()
    .setTitle("📋 NOVO REGISTRO")
    .setDescription(
      `ID: ${reg.id}\nNome: ${reg.nome}\nData: ${reg.data}\nRecrutador: ${reg.recrutador}`
    )
    .setImage(photo.url);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("aprovar").setLabel("✅ Aprovar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("reprovar").setLabel("❌ Reprovar").setStyle(ButtonStyle.Danger)
  );

  const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID);
  const logMsg = await logChannel.send({ embeds: [embed], components: [row] });

  logMessages.set(logMsg.id, {
    userId: message.author.id,
    channelId: canaisAbertos.get(message.author.id)
  });

  registros.delete(message.author.id);

  // timeout automático
  const timeout = setTimeout(async () => {
    const canal = await message.guild.channels.fetch(canaisAbertos.get(message.author.id)).catch(() => null);
    if (canal) await canal.delete().catch(() => null);
  }, TIMEOUT_MINUTES * 60 * 1000);

  timeouts.set(logMsg.id, timeout);

  await message.reply("✅ Registro enviado para aprovação.");
});

/* =========================
   START
========================= */

client.login(BOT_TOKEN);