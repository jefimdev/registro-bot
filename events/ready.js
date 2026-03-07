module.exports = {
  name: "clientReady",

  async execute(client) {
    console.log(`🟢 Logado como ${client.user.tag}`);
  }
};