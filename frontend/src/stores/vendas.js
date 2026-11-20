/* Detalhe da venda, devolução/troca de itens e cancelamento. */
import { defineStore } from 'pinia';
import { ref, reactive, computed } from 'vue';
import { MOTIVOS_DEVOLUCAO, FORMAS_ESTORNO } from '@/domain/constants';
import { brl } from '@/domain/utils';
import { nomeCompleto } from '@/domain/clients';
import { itensDevolviveis, previaDevolucao, previaCancelamento } from '@/domain/devolucoes';
import { api } from '@/services/api';
import { useDbStore } from './db';
import { useUiStore } from './ui';
import { useCaixaStore } from './caixa';
import { usePdvStore } from './pdv';

const FORMA_PADRAO = { dinheiro: 'dinheiro', pix: 'pix', debito: 'cartao', credito: 'cartao', crediario: 'dinheiro' };

export const useVendasStore = defineStore('vendas', () => {
  const db = useDbStore(); const ui = useUiStore(); const caixa = useCaixaStore();
  const state = db.state;

  const vendaId = ref(null);
  const venda = computed(() => state.sales.find(s => s.id === vendaId.value) || null);
  const vendaCliente = computed(() => venda.value && venda.value.clienteId ? state.clientes.find(c => c.id === venda.value.clienteId) : null);
  const vendaItens = computed(() => venda.value ? itensDevolviveis(venda.value) : []);
  const abrirVenda = id => { vendaId.value = id; };
  const fecharVenda = () => { vendaId.value = null; };

  /* ---------- devolução e troca ---------- */
  const devol = reactive({ open: false, qtds: {}, destino: 'troca', forma: 'dinheiro', motivo: MOTIVOS_DEVOLUCAO[0], obs: '' });
  const openDevolucao = () => { const s = venda.value; if (!s) return;
    const qtds = {}; vendaItens.value.forEach(i => { qtds[i.sku] = i.disponivel === 1 && vendaItens.value.length === 1 ? 1 : 0; });
    Object.assign(devol, { open: true, qtds, destino: 'troca', forma: FORMA_PADRAO[s.pagamento], motivo: MOTIVOS_DEVOLUCAO[0], obs: '' }); };
  const devPrevia = computed(() => venda.value && devol.open ? previaDevolucao(venda.value, devol.qtds) : null);
  const motivoTexto = () => devol.motivo === 'Outro' ? (devol.obs.trim() || 'Outro') : devol.motivo + (devol.obs.trim() ? `. ${devol.obs.trim()}` : '');
  const devErro = computed(() => {
    if (!devPrevia.value || !devPrevia.value.itens.length) return 'Escolha as peças que estão voltando.';
    if (devol.motivo === 'Outro' && !devol.obs.trim()) return 'Descreva o motivo.';
    if (devol.destino === 'estorno' && devol.forma === 'dinheiro' && !caixa.atual && venda.value.pagamento !== 'crediario') return 'Abra o caixa para devolver em dinheiro.';
    if (devol.destino === 'troca' && !caixa.atual) return 'Abra o caixa para fazer a troca no PDV.';
    return ''; });
  const confirmarDevolucao = async () => {
    if (devErro.value) return;
    const s = venda.value; const prev = devPrevia.value; const pecas = prev.itens.map(i => `${i.qtd}x ${i.nome} ${i.tam}`).join(', ');
    if (devol.destino === 'troca') {
      usePdvStore().iniciarTroca({ vendaId: s.id, qtds: { ...devol.qtds }, valor: prev.valor, motivo: motivoTexto(), pecas, clienteId: s.clienteId });
      devol.open = false; vendaId.value = null; location.hash = '#pdv';
      ui.notify(`Crédito de ${brl(prev.valor)} no PDV. Escolha os novos produtos.`);
      return;
    }
    const d = await db.executar(() => api.devolver(s.id, { qtds: { ...devol.qtds }, forma: devol.forma, motivo: motivoTexto() }));
    if (!d) return;
    devol.open = false; ui.notify(`Devolução registrada: ${d.resumo}.`);
  };

  /* ---------- cancelamento ---------- */
  const canc = reactive({ open: false, forma: 'pix', motivo: '' });
  const openCancelamento = () => { if (!venda.value) return; Object.assign(canc, { open: true, forma: FORMA_PADRAO[venda.value.pagamento], motivo: '' }); };
  const cancPrevia = computed(() => venda.value && canc.open ? previaCancelamento(state, venda.value) : null);
  const cancErro = computed(() => {
    if (!cancPrevia.value) return '';
    if (!cancPrevia.value.podeCancelar) return 'Esta venda já teve devolução. Use "Devolver ou trocar" para as peças restantes.';
    if (canc.motivo.trim().length < 3) return 'Informe o motivo do cancelamento.';
    if (cancPrevia.value.jaRecebido > 0 && canc.forma === 'dinheiro' && !caixa.atual) return 'Abra o caixa para devolver em dinheiro.';
    return ''; });
  const confirmarCancelamento = async () => {
    if (cancErro.value) return;
    const id = venda.value.id;
    if (!await db.executar(() => api.cancelar(id, { forma: canc.forma, motivo: canc.motivo.trim() }))) return;
    canc.open = false; ui.notify(`Venda #${id} cancelada.`);
  };

  const clienteNome = id => { const c = state.clientes.find(x => x.id === id); return c ? nomeCompleto(c) : ''; };

  return { vendaId, venda, vendaCliente, vendaItens, abrirVenda, fecharVenda, devol, openDevolucao, devPrevia, devErro, confirmarDevolucao,
    canc, openCancelamento, cancPrevia, cancErro, confirmarCancelamento, clienteNome };
});
