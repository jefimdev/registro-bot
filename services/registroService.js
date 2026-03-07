const registros = new Map();
const canaisAbertos = new Map();
const timeouts = new Map();

module.exports = {

  criar(userId, channelId) {
    canaisAbertos.set(userId, channelId);
  },

  existe(userId) {
    return canaisAbertos.has(userId);
  },

  salvarDados(userId, dados) {
    registros.set(userId, { ...dados });
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
    canaisAbertos.delete(userId);
  },

  setTimeout(msgId, timeout) {
    timeouts.set(msgId, timeout);
  },

  clearTimeout(msgId) {
    const t = timeouts.get(msgId);
    if (t) clearTimeout(t);
    timeouts.delete(msgId);
  }

};