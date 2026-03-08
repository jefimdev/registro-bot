const registros = new Map();

module.exports = {

  criar(userId, channelId) {
    registros.set(channelId, { userId, channelId });
  },

  existe(userId) {
    return [...registros.values()].some(r => r.userId === userId);
  },

  salvarDados(userId, dados) {
    const registro = [...registros.values()].find(r => r.userId === userId);
    if (!registro) return;
    Object.assign(registro, dados);
  },

  salvarFoto(userId, foto) {
    const registro = [...registros.values()].find(r => r.userId === userId);
    if (!registro) return;
    registro.foto = foto; // agora salva objeto { url, name }
  },

  pegarPorCanal(channelId) {
    return registros.get(channelId);
  },

  finalizar(channelId) {
    registros.delete(channelId);
  }

};