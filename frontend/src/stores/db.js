/* Dados da loja vindos do servidor. As telas leem db.state (montado pela API a partir das tabelas);
   nenhuma tela altera db.state direto: cada operação chama a API, que aplica as regras numa transação,
   e em seguida os dados são recarregados. */
import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { vendaValida } from '@/domain/sales';
import { api } from '@/services/api';
import { useUiStore } from './ui';
import { useSessionStore } from './session';

const ATUALIZAR_AO_VOLTAR_MS = 30000; // ao voltar para a aba, recarrega se passou esse tempo (outro aparelho pode ter vendido)

export const useDbStore = defineStore('db', () => {
  const ui = useUiStore();
  const state = reactive({});
  const carregado = ref(false);
  const sync = reactive({ salvando: false, erro: '' });
  let ultimaCarga = 0;

  async function carregar() {
    const dados = await api.loja();
    Object.keys(state).forEach(k => delete state[k]);
    Object.assign(state, dados);
    carregado.value = true; ultimaCarga = Date.now(); sync.erro = '';
  }

  /* Executa uma operação na API e recarrega os dados. Erros vão para o aviso na tela e devolvem null.
     Enquanto uma operação está em andamento, outra não começa (evita clique duplo). */
  async function executar(operacao, { recarregar = true } = {}) {
    if (sync.salvando) return null;
    sync.salvando = true;
    try {
      const r = await operacao();
      if (recarregar) await carregar();
      return r || {};
    } catch (e) {
      if (e.status === 401) { useSessionStore().expirou(); return null; }
      if (e.status === 0) sync.erro = 'Sem conexão com o servidor. Confira a internet e tente de novo.';
      ui.notify(e.message || 'Não foi possível concluir. Tente de novo.');
      // os dados da tela podem estar desatualizados (outro aparelho mexeu): recarrega para a próxima tentativa
      if (e.status === 409 || e.status === 422) carregar().catch(() => {});
      return null;
    } finally {
      sync.salvando = false;
    }
  }

  const aoVoltar = () => { if (carregado.value && !sync.salvando && document.visibilityState === 'visible' && Date.now() - ultimaCarga > ATUALIZAR_AO_VOLTAR_MS) carregar().catch(() => {}); };
  document.addEventListener('visibilitychange', aoVoltar);

  /* Apaga a operação e volta aos produtos e estoque iniciais. Exige a senha de quem está logado. */
  async function reiniciar(senha) {
    await api.reiniciar(senha);
    await carregar();
  }

  /* Vendas válidas do mês (sem as canceladas). */
  const salesOfMonth = m => state.sales.filter(s => s.data.startsWith(m) && vendaValida(s));

  return { state, carregado, sync, carregar, executar, reiniciar, salesOfMonth };
});
