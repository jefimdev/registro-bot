require("dotenv").config();

/* =========================
   🚀 HEALTH SERVER (PRIMEIRO DE TUDO)
========================= */

const http = require("http");
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
  }
  res.writeHead(200);
  res.end("Bot online");
}).listen(PORT, "0.0.0.0", () => {
  console.log("🌐 Health server rodando na porta " + PORT);
});

/* =========================
   📦 IMPORTS DISCORD
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

/* =========================
   🔐 ENV
========================= */

const {
  BOT_TOKEN,
  GUILD_ID,
  LOG_CHANNEL_ID,
  APPROVER_ROLE_ID,
  MEMBER_ROLE_ID,
  TICKET_CATEGORY_ID,
} = process.env;

if (!BOT_TOKEN) console.error("❌ BOT_TOKEN ausente");
if (!GUILD_ID) console.error("❌ GUILD_ID ausente");

/* =========================
   🤖 CLIENT
========================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

/* =========================
   🧠 MEMÓRIA
========================= */

const regByUser = new Map();
const userByChannel = new Map();

/* =========================
   🔧 FUNÇÕES AUXILIARES
========================= */

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

async function sendToLog(guild, payload) {
  const logCh = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!logCh) return;
  await logCh.send(payload);
}

async function createRegistroChannel(guild, userId, username) {
  return guild.channels.create({
    name: `registro-${cleanName(username)}-${userId.slice(-4)}`,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: userId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: APPROVER_ROLE_ID,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
    ],
  });
}

/* =========================
   📝 SLASH COMMAND (RÁPIDO - GUILD)
========================= */

async function registerCommands(appId) {
  const commands = [
    { name: "registrar", description: "Abrir registro" }
  ];

  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(appId, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Slash registrado na guild");
}

/* =========================
   🚀 READY
========================= */

client.once("clientReady", async () => {
  console.log("🟢 Bot logado como " + client.user.tag);
  try {
    await client.application.fetch();
    await registerCommands(client.application.id);
  } catch (err) {
    console.error("Erro ao registrar comando:", err);
  }
});

/* =========================
   🎮 INTERAÇÕES
========================= */

client.on("interactionCreate", async (interaction) => {
  try {

    if (interaction.isChatInputCommand() && interaction.commandName === "registrar") {
      const guild = await client.guilds.fetch(GUILD_ID);

      if (regByUser.has(interaction.user.id)) {
        return interaction.reply({
          content: "⚠️ Você já possui um registro aberto.",
          ephemeral: true,
        });
      }

      const ch = await createRegistroChannel(
        guild,
        interaction.user.id,
        interaction.user.username
      );

      regByUser.set(interaction.user.id, {
        channelId: ch.id,
        photoUrl: null,
      });

      userByChannel.set(ch.id, interaction.user.id);

      await interaction.reply({
        content: `✅ Canal criado: <#${ch.id}>`,
        ephemeral: true,
      });
    }

  } catch (err) {
    console.error(err);
  }
});

/* =========================
   📸 FOTO
========================= */

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const ownerId = userByChannel.get(message.channelId);
  if (!ownerId) return;
  if (message.author.id !== ownerId) return;

  if (message.attachments.size === 0) {
    return message.reply("❌ Envie a foto como ANEXO.");
  }

  const att = message.attachments.first();
  if (!isImageAttachment(att)) {
    return message.reply("❌ Apenas imagens são permitidas.");
  }

  const reg = regByUser.get(ownerId);
  reg.photoUrl = att.url;

  const embed = new EmbedBuilder()
    .setTitle("📋 REGISTRO RECEBIDO")
    .setImage(att.url);

  await sendToLog(message.guild, { embeds: [embed] });

  await message.reply("✅ Foto enviada para análise.");

});

/* =========================
   🟢 START
========================= */

client.login(BOT_TOKEN);