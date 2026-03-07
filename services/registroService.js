const registros = new Map();

module.exports = {

  criar(userId, channelId) {
    registros.set(userId, { userId, channelId });
  },

  existe(userId) {
    return registros.has(userId);
  },

  salvarDados(userId, dados) {
    const r = registros.get(userId);
    if (!r) return;
    Object.assign(r, dados);
  },

  salvarFoto(userId, foto) {
    const r = registros.get(userId);
    if (!r) return;
    r.foto = foto;
  },

  pegar(userId) {
    return registros.get(userId);
  },

  finalizar(userId) {
    registros.delete(userId);
  }

};