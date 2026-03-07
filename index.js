require("dotenv").config();
const http = require("http");

http.createServer((req, res) => {
  res.statusCode = 200;
  res.end("OK");
}).listen(process.env.PORT || 8080, "0.0.0.0");

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

/* Carregar comandos */
for (const file of fs.readdirSync("./src/commands")) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

/* Carregar eventos */
for (const file of fs.readdirSync("./src/events")) {
  const event = require(`./events/${file}`);
  client.on(event.name, (...args) => event.execute(...args, client));
}

client.login(process.env.BOT_TOKEN);