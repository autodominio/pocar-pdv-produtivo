/* Auditoria: quem fez o quê. O servidor registra cada operação junto com ela; aqui ficam a consulta
   e o registro das ações feitas só na tela (PDF do relatório e das etiquetas). */
import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { api } from '@/services/api';

const POR_PAGINA = 100;

export const useAuditStore = defineStore('audit', () => {
  const registrar = (acao, detalhe) => api.registrarTela(acao, detalhe).catch(e => console.warn('Auditoria não registrada', e));

  const audq = reactive({ usuario: '', periodo: '7d', busca: '' });
  const registros = ref([]); const temMais = ref(false); const carregando = ref(false); const erro = ref('');
  const usuariosNoLog = ref([]);

  async function carregar(maisAntigos = false) {
    carregando.value = true; erro.value = '';
    try {
      const antesDe = maisAntigos && registros.value.length ? registros.value[registros.value.length - 1].id : '';
      const r = await api.auditoria({ usuario: audq.usuario, periodo: audq.periodo, busca: audq.busca.trim(), antesDe, limite: POR_PAGINA });
      registros.value = maisAntigos ? registros.value.concat(r.registros) : r.registros; temMais.value = r.temMais;
      if (!maisAntigos) usuariosNoLog.value = await api.auditoriaUsuarios();
    } catch (e) { erro.value = e.message; }
    finally { carregando.value = false; }
  }

  return { registrar, audq, registros, temMais, carregando, erro, usuariosNoLog, carregar };
});
