// index.js — Bot Registro + Aprovar/Reprovar + KeepAlive Railway (Discord.js v14)
require("dotenv").config();

const http = require("http");
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  PermissionsBitField
} = require("discord.js");

// ===================== CONFIG (ENV) =====================
// Obrigatórios no Railway (Variables):
// BOT_TOKEN=
// GUILD_ID=1474368606128181373
// LOG_CHANNEL_ID=1475645181905600624
// APPROVER_ROLE_ID=1476054786573992087
// MEMBER_ROLE_ID=1474810158587580517

const BOT_TOKEN = process.env.BOT_TOKEN;

const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const APPROVER_ROLE_ID = process.env.APPROVER_ROLE_ID; // liderança
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID;     // membro

// ===================== VALIDAÇÕES =====================
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

// ===================== KEEP ALIVE (RAILWAY) =====================
// Responde rápido para healthcheck
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot online ✅");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 HTTP ativo (healthcheck) na porta ${PORT}`);
});

// Extra “cinto de segurança” para ambientes que encerram processo
setInterval(() => {}, 60_000);

// ===================== DISCORD CLIENT =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// ===================== SLASH COMMANDS (GLOBAL) =====================
// Global evita "Missing Access" por guild
async function registerCommands(appId) {
  const commands = [
    { name: "registrar", description: "Abrir painel de registro (botão + formulário)" }
  ];

  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

  await rest.put(
    Routes.applicationCommands(appId), // GLOBAL
    { body: commands }
  );

  console.log("✅ Slash command /registrar registrado!");
}

// ===================== LOGS / ERROS =====================
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
process.on("SIGTERM", () => {
  console.log("🟡 Recebi SIGTERM. Fechando com segurança...");
  try { server.close(); } catch {}
  try { client.destroy(); } catch {}
  process.exit(0);
});

// ===================== READY =====================
client.once("clientReady", async () => {
  console.log(`🟢 Logado como ${client.user.tag} (ID: ${client.user.id})`);

  try {
    await client.application.fetch();
    await registerCommands(client.application.id);
  } catch (e) {
    console.error("❌ Erro ao registrar comandos:", e);
  }
});

// ===================== INTERAÇÕES =====================
client.on("interactionCreate", async (interaction) => {
  try {
    // /registrar
    if (interaction.isChatInputCommand() && interaction.commandName === "registrar") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_register_modal")
          .setLabel("📋 Fazer Registro")
          .setStyle(ButtonStyle.Primary)
      );

      const embed = new EmbedBuilder()
        .setTitle("📋 REGISTRO DA ORGANIZAÇÃO")
        .setDescription("Clique no botão abaixo e preencha sua ficha corretamente.")
        .setFooter({ text: "Sistema de Registro" });

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
    }

    // Botão abre Modal
    if (interaction.isButton() && interaction.customId === "open_register_modal") {
      const modal = new ModalBuilder()
        .setCustomId("register_modal")
        .setTitle("📋 Formulário de Registro");

      const idField = new TextInputBuilder()
        .setCustomId("field_id")
        .setLabel("ID")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const nomeField = new TextInputBuilder()
        .setCustomId("field_nome")
        .setLabel("Nome no Jogo")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const recrutadorField = new TextInputBuilder()
        .setCustomId("field_recrutador")
        .setLabel("Recrutador")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const dataField = new TextInputBuilder()
        .setCustomId("field_data")
        .setLabel("Data do Recrutamento (ex: 23/02/2026)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const fotoField = new TextInputBuilder()
        .setCustomId("field_foto")
        .setLabel("Link da Foto (Discord/Imgur/Drive)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(idField),
        new ActionRowBuilder().addComponents(nomeField),
        new ActionRowBuilder().addComponents(recrutadorField),
        new ActionRowBuilder().addComponents(dataField),
        new ActionRowBuilder().addComponents(fotoField)
      );

      return interaction.showModal(modal);
    }

    // Modal enviado -> manda no canal + botões aprovar/reprovar
    if (interaction.isModalSubmit() && interaction.customId === "register_modal") {
      const id = interaction.fields.getTextInputValue("field_id");
      const nome = interaction.fields.getTextInputValue("field_nome");
      const recrutador = interaction.fields.getTextInputValue("field_recrutador");
      const data = interaction.fields.getTextInputValue("field_data");
      const foto = interaction.fields.getTextInputValue("field_foto");

      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (!logChannel) {
        return interaction.reply({
          content: "⚠️ Canal de log não encontrado. Confira LOG_CHANNEL_ID.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📋 NOVO REGISTRO")
        .setDescription(
          `🪪 **ID:** ${id}\n` +
          `👤 **Nome no Jogo:** ${nome}\n` +
          `🤝 **Recrutador:** ${recrutador}\n` +
          `📅 **Data:** ${data}\n` +
          `📸 **Foto:** ${foto}\n\n` +
          `👤 **Usuário:** ${interaction.user} (\`${interaction.user.id}\`)\n` +
          `✅ **Status:** Aguardando aprovação`
        )
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: "Aprovar/Reprovar abaixo" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_${interaction.user.id}`)
          .setLabel("✅ Aprovar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_${interaction.user.id}`)
          .setLabel("❌ Reprovar")
          .setStyle(ButtonStyle.Danger)
      );

      await logChannel.send({ embeds: [embed], components: [row] });

      return interaction.reply({ content: "✅ Registro enviado para a liderança.", ephemeral: true });
    }

    // Aprovar / Reprovar
    if (
      interaction.isButton() &&
      (interaction.customId.startsWith("approve_") || interaction.customId.startsWith("reject_"))
    ) {
      const clicker = await interaction.guild.members.fetch(interaction.user.id);

      const hasApproverRole = clicker.roles.cache.has(APPROVER_ROLE_ID);
      const isAdmin = clicker.permissions.has(PermissionsBitField.Flags.Administrator);

      if (!hasApproverRole && !isAdmin) {
        return interaction.reply({ content: "🚫 Você não tem permissão para aprovar/reprovar.", ephemeral: true });
      }

      const targetUserId = interaction.customId.split("_")[1];
      const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: "⚠️ Não encontrei o membro (talvez saiu do servidor).", ephemeral: true });
      }

      const isApprove = interaction.customId.startsWith("approve_");

      const oldEmbed = interaction.message.embeds?.[0];
      const newEmbed = EmbedBuilder.from(oldEmbed || {})
        .setDescription(
          (oldEmbed?.description || "") +
          `\n\n📌 **Decisão:** ${isApprove ? "✅ Aprovado" : "❌ Reprovado"} por ${interaction.user}`
        )
        .setFooter({ text: "Decisão registrada" });

      await interaction.update({ embeds: [newEmbed], components: [] });

      if (isApprove) {
        await targetMember.roles.add(MEMBER_ROLE_ID).catch(() => null);
        await targetMember.send("✅ Seu registro foi **aprovado**. Bem-vindo(a)!").catch(() => null);
      } else {
        await targetMember.send("❌ Seu registro foi **reprovado**. Procure a liderança para ajustes.").catch(() => null);
      }
    }
  } catch (err) {
    console.error(err);
    if (interaction?.isRepliable()) {
      try { await interaction.reply({ content: "⚠️ Ocorreu um erro.", ephemeral: true }); } catch {}
    }
  }
});

// ===================== LOGIN (ÚLTIMA LINHA) =====================
client.login(process.env.BOT_TOKEN);