require("dotenv").config();

const http = require("http");
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

// ===================== ENV =====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const APPROVER_ROLE_ID = process.env.APPROVER_ROLE_ID;
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;

function must(name, value) {
  if (!value) {
    console.error(`❌ Variável ausente: ${name}`);
    process.exit(1);
  }
}

must("BOT_TOKEN", BOT_TOKEN);
must("GUILD_ID", GUILD_ID);
must("LOG_CHANNEL_ID", LOG_CHANNEL_ID);
must("APPROVER_ROLE_ID", APPROVER_ROLE_ID);
must("MEMBER_ROLE_ID", MEMBER_ROLE_ID);
must("TICKET_CATEGORY_ID", TICKET_CATEGORY_ID);

// ===================== KEEP ALIVE (RAILWAY) =====================
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("OK");
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot online ✅");
  })
  .listen(PORT, "0.0.0.0", () => console.log(`🌐 HTTP ativo na porta ${PORT}`));

// ===================== CLIENT =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ===================== “DB” EM MEMÓRIA =====================
// userId -> { channelId, id, nome, recrutador, data, photoUrl, status }
const regByUser = new Map();
// channelId -> userId
const userByChannel = new Map();

function cleanName(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10) || "user";
}

function isImageAttachment(att) {
  const name = (att.name || "").toLowerCase();
  const ct = (att.contentType || "").toLowerCase();
  if (ct.startsWith("image/")) return true;
  return /\.(png|jpg|jpeg|webp)$/i.test(name);
}

function linkOnly(content) {
  const c = (content || "").trim();
  return c && /^https?:\/\/\S+$/i.test(c);
}

async function createRegistroChannel(guild, userId, username) {
  const channelName = `registro-${cleanName(username)}-${userId.slice(-4)}`;

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel],
    },
    {
      id: userId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
      ],
    },
    {
      id: APPROVER_ROLE_ID,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.ManageMessages,
      ],
    },
    {
      id: client.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.ManageMessages,
        PermissionsBitField.Flags.AttachFiles,
      ],
    },
  ];

  const ch = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: overwrites,
    reason: "Canal de registro criado pelo bot",
  });

  return ch;
}

async function sendToLog(guild, payload) {
  const logCh = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!logCh) throw new Error("LOG_CHANNEL_ID inválido ou sem acesso.");
  await logCh.send(payload);
}

// ===================== COMMANDS =====================
async function registerCommands(appId) {
  const commands = [{ name: "registrar", description: "Abrir registro (cria canal privado)" }];
  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
  await rest.put(Routes.applicationCommands(appId), { body: commands });
  console.log("✅ Slash /registrar registrado (global).");
}

client.once("clientReady", async () => {
  console.log(`🟢 Logado como ${client.user.tag}`);
  try {
    await client.application.fetch();
    await registerCommands(client.application.id);
  } catch (e) {
    console.error("❌ Falha ao registrar comandos:", e);
  }
});

// ===================== INTERACTIONS =====================
client.on("interactionCreate", async (interaction) => {
  try {
    // /registrar
    if (interaction.isChatInputCommand() && interaction.commandName === "registrar") {
      const guild = await client.guilds.fetch(GUILD_ID);

      // se já tem canal aberto
      const existing = regByUser.get(interaction.user.id);
      if (existing?.channelId) {
        return interaction.reply({
          content: `⚠️ Você já tem um registro aberto: <#${existing.channelId}>`,
          ephemeral: true,
        });
      }

      // cria canal
      const ch = await createRegistroChannel(guild, interaction.user.id, interaction.user.username);

      regByUser.set(interaction.user.id, {
        channelId: ch.id,
        id: null,
        nome: null,
        recrutador: null,
        data: null,
        photoUrl: null,
        status: "AGUARDANDO_DADOS",
      });
      userByChannel.set(ch.id, interaction.user.id);

      // manda instruções no canal
      const intro = new EmbedBuilder()
        .setTitle("📋 REGISTRO")
        .setDescription(
          `Bem-vindo(a), <@${interaction.user.id}>!\n\n` +
            `1) Clique no botão **Preencher Dados**\n` +
            `2) Depois, envie **A FOTO DO PERSONAGEM** como **ANEXO** aqui no canal (JPG/PNG)\n` +
            `❌ Não envie link\n\n` +
            `A liderança vai aprovar ✅ ou reprovar ❌.`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("open_modal").setLabel("📝 Preencher Dados").setStyle(ButtonStyle.Primary)
      );

      await ch.send({ content: `<@&${APPROVER_ROLE_ID}>`, embeds: [intro], components: [row] });

      return interaction.reply({
        content: `✅ Canal de registro criado: <#${ch.id}>`,
        ephemeral: true,
      });
    }

    // botão abre modal
    if (interaction.isButton() && interaction.customId === "open_modal") {
      const ownerId = userByChannel.get(interaction.channelId);
      if (!ownerId) return interaction.reply({ content: "⚠️ Este canal não é de registro.", ephemeral: true });

      // só dono do registro pode preencher
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "🚫 Só o dono do registro pode preencher os dados.", ephemeral: true });
      }

      const modal = new ModalBuilder().setCustomId("reg_modal").setTitle("📋 Dados do Registro");

      const f1 = new TextInputBuilder().setCustomId("field_id").setLabel("ID").setStyle(TextInputStyle.Short).setRequired(true);
      const f2 = new TextInputBuilder().setCustomId("field_nome").setLabel("Nome no jogo").setStyle(TextInputStyle.Short).setRequired(true);
      const f3 = new TextInputBuilder().setCustomId("field_recrutador").setLabel("Recrutador").setStyle(TextInputStyle.Short).setRequired(true);
      const f4 = new TextInputBuilder().setCustomId("field_data").setLabel("Data do recrutamento").setStyle(TextInputStyle.Short).setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(f1),
        new ActionRowBuilder().addComponents(f2),
        new ActionRowBuilder().addComponents(f3),
        new ActionRowBuilder().addComponents(f4)
      );

      return interaction.showModal(modal);
    }

    // modal submit
    if (interaction.isModalSubmit() && interaction.customId === "reg_modal") {
      const ownerId = userByChannel.get(interaction.channelId);
      if (!ownerId) return interaction.reply({ content: "⚠️ Este canal não é de registro.", ephemeral: true });
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "🚫 Só o dono do registro pode enviar os dados.", ephemeral: true });
      }

      const reg = regByUser.get(ownerId);
      if (!reg) return interaction.reply({ content: "⚠️ Registro não encontrado.", ephemeral: true });

      reg.id = interaction.fields.getTextInputValue("field_id").trim();
      reg.nome = interaction.fields.getTextInputValue("field_nome").trim();
      reg.recrutador = interaction.fields.getTextInputValue("field_recrutador").trim();
      reg.data = interaction.fields.getTextInputValue("field_data").trim();
      reg.status = "AGUARDANDO_FOTO";

      const embed = new EmbedBuilder()
        .setTitle("📸 AGORA ENVIE A FOTO DO PERSONAGEM")
        .setDescription(
          "Envie **a foto do personagem como ANEXO** aqui neste canal.\n" +
            "✅ Aceito: JPG/PNG/WEBP\n" +
            "❌ Não aceito: link\n\n" +
            "Depois disso, a liderança poderá aprovar ✅ ou reprovar ❌."
        )
        .addFields(
          { name: "ID", value: reg.id, inline: true },
          { name: "Nome", value: reg.nome, inline: true },
          { name: "Recrutador", value: reg.recrutador, inline: true },
          { name: "Data", value: reg.data, inline: true }
        );

      await interaction.reply({ content: "✅ Dados salvos! Agora envie a foto como **ANEXO**.", ephemeral: true });
      await interaction.channel.send({ embeds: [embed] });
    }

    // aprovar / reprovar (botões aparecem só depois da foto)
    if (interaction.isButton() && (interaction.customId === "approve" || interaction.customId === "reject")) {
      const ownerId = userByChannel.get(interaction.channelId);
      if (!ownerId) return interaction.reply({ content: "⚠️ Canal inválido.", ephemeral: true });

      // permissão liderança
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isLeader = member.roles.cache.has(APPROVER_ROLE_ID);
      const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isLeader && !isAdmin) return interaction.reply({ content: "🚫 Sem permissão.", ephemeral: true });

      const reg = regByUser.get(ownerId);
      if (!reg?.photoUrl) {
        return interaction.reply({ content: "⚠️ Ainda não existe foto anexada pelo usuário.", ephemeral: true });
      }

      const approved = interaction.customId === "approve";

      // dá cargo se aprovado
      const targetMember = await interaction.guild.members.fetch(ownerId).catch(() => null);
      if (approved && targetMember) {
        await targetMember.roles.add(MEMBER_ROLE_ID).catch(() => null);
      }

      // monta embed final para LOG_CHANNEL
      const embed = new EmbedBuilder()
        .setTitle(`📋 REGISTRO ${approved ? "✅ APROVADO" : "❌ REPROVADO"}`)
        .setDescription(
          `👤 Usuário: <@${ownerId}> (\`${ownerId}\`)\n` +
            `🧾 ID: **${reg.id}**\n` +
            `🎮 Nome: **${reg.nome}**\n` +
            `🤝 Recrutador: **${reg.recrutador}**\n` +
            `📅 Data: **${reg.data}**\n` +
            `🛡️ Staff: ${interaction.user}\n`
        )
        .setImage(reg.photoUrl)
        .setFooter({ text: `Canal: ${interaction.channel.name}` });

      await sendToLog(interaction.guild, { embeds: [embed] });

      // avisa no canal e fecha
      await interaction.reply({ content: `✅ Registro ${approved ? "aprovado" : "reprovado"}! Enviado para o LOG e fechando canal...`, ephemeral: false });

      // limpeza + fechar canal
      regByUser.delete(ownerId);
      userByChannel.delete(interaction.channelId);

      setTimeout(async () => {
        await interaction.channel.delete("Registro finalizado").catch(() => null);
      }, 4000);
    }
  } catch (e) {
    console.error(e);
    if (interaction?.isRepliable()) {
      try {
        await interaction.reply({ content: "⚠️ Ocorreu um erro.", ephemeral: true });
      } catch {}
    }
  }
});

// ===================== CAPTURA DA FOTO (anexo obrigatório) =====================
client.on("messageCreate", async (message) => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const ownerId = userByChannel.get(message.channelId);
    if (!ownerId) return; // não é canal de registro

    // só o dono do registro pode enviar a foto
    if (message.author.id !== ownerId) return;

    const reg = regByUser.get(ownerId);
    if (!reg) return;

    // bloqueia link
    if (message.attachments.size === 0 && linkOnly(message.content)) {
      return message.reply("❌ Não aceito link. Envie a foto como **ANEXO** (JPG/PNG).");
    }

    // precisa ter anexo
    if (message.attachments.size === 0) {
      return message.reply("❌ Você precisa anexar a **FOTO DO PERSONAGEM** (JPG/PNG).");
    }

    const att = message.attachments.first();
    if (!isImageAttachment(att)) {
      return message.reply("❌ Arquivo inválido. Envie **imagem** (JPG/PNG/WEBP).");
    }

    // salva url da foto
    reg.photoUrl = att.url;
    reg.status = "PRONTO_PARA_APROVACAO";

    // manda botões de aprovação
    const embed = new EmbedBuilder()
      .setTitle("✅ FOTO RECEBIDA")
      .setDescription("A liderança pode aprovar ✅ ou reprovar ❌ abaixo.")
      .setImage(reg.photoUrl);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("approve").setLabel("✅ Aprovar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("reject").setLabel("❌ Reprovar").setStyle(ButtonStyle.Danger)
    );

    await message.reply({ content: "✅ Foto recebida! Aguarde a liderança.", embeds: [embed], components: [row] });
  } catch (e) {
    console.error(e);
  }
});

// ===================== START =====================
client.login(BOT_TOKEN);