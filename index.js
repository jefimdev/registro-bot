require("dotenv").config();
const http = require("http");

/* ===== HEALTH SERVER ===== */
http.createServer((req, res) => {
  res.statusCode = 200;
  res.end("OK");
}).listen(process.env.PORT || 8080, "0.0.0.0");

/* ===== DISCORD ===== */
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Partials } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.commands = new Map();

/* ===== CARREGAR COMANDOS ===== */
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath)) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

/* ===== CARREGAR EVENTOS ===== */
const eventsPath = path.join(__dirname, "events");
for (const file of fs.readdirSync(eventsPath)) {
  const event = require(`./events/${file}`);
  client.on(event.name, (...args) => event.execute(...args, client));
}

client.login(process.env.BOT_TOKEN);