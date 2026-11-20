/* Caixa: abertura, adicionar/remover dinheiro (tipos internos 'suprimento'/'sangria'), fechamento com conferência e lista de vendas. */
import { defineStore } from 'pinia';
import { reactive, computed } from 'vue';
import { VALOR_INICIAL_CAIXA } from '@/domain/constants';
import { round2, isoDate, addDays, startOfToday, brl, todayIso } from '@/domain/utils';
import { caixaAberto, resumoCaixa } from '@/domain/caixa';
import { nomeCompleto } from '@/domain/clients';
import { api } from '@/services/api';
import { useDbStore } from './db';
import { useUiStore } from './ui';

const LIMITE_LISTA = 200;

export const useCaixaStore = defineStore('caixa', () => {
  const db = useDbStore(); const ui = useUiStore();
  const state = db.state;

  const atual = computed(() => caixaAberto(state));
  const resumoAtual = computed(() => atual.value ? resumoCaixa(state, atual.value) : null);
  const historico = computed(() => state.caixas.filter(c => c.fechadoEm).slice().reverse().map(c => ({ ...c, resumo: resumoCaixa(state, c) })));

  /* ---------- abertura ---------- */
  const cxAbrir = reactive({ open: false, valor: VALOR_INICIAL_CAIXA, obs: '' });
  const openAbrir = () => Object.assign(cxAbrir, { open: true, valor: VALOR_INICIAL_CAIXA, obs: '' });
  const abrirErro = computed(() => atual.value ? 'Já existe um caixa aberto.' : !(cxAbrir.valor >= 0) ? 'Informe o troco inicial (pode ser zero).' : '');
  const abrirCaixa = async () => {
    if (abrirErro.value) return;
    if (!await db.executar(() => api.abrirCaixa({ valor: round2(cxAbrir.valor), obs: cxAbrir.obs.trim() }))) return;
    cxAbrir.open = false; ui.notify('Caixa aberto. Boas vendas!');
  };

  /* ---------- adicionar ao caixa (suprimento) e remover do caixa (sangria) ---------- */
  const cxMov = reactive({ open: false, tipo: 'sangria', valor: null, motivo: '' });
  const openMov = tipo => Object.assign(cxMov, { open: true, tipo, valor: null, motivo: tipo === 'sangria' ? 'Depósito no banco' : 'Reforço de troco' });
  const movErro = computed(() => {
    if (!atual.value) return 'Abra o caixa primeiro.';
    if (!(cxMov.valor > 0)) return 'Informe o valor.';
    if (cxMov.tipo === 'sangria' && cxMov.valor > resumoAtual.value.esperado) return `A gaveta tem ${brl(resumoAtual.value.esperado)} em dinheiro.`;
    if (!cxMov.motivo.trim()) return 'Informe o motivo.';
    return ''; });
  const salvarMov = async () => {
    if (movErro.value) return;
    if (!await db.executar(() => api.movimentoCaixa({ tipo: cxMov.tipo, valor: round2(cxMov.valor), motivo: cxMov.motivo.trim() }))) return;
    cxMov.open = false; ui.notify(cxMov.tipo === 'sangria' ? 'Dinheiro removido do caixa.' : 'Dinheiro adicionado ao caixa.');
  };

  /* ---------- fechamento ---------- */
  const cxFechar = reactive({ open: false, contado: null, obs: '' });
  const openFechar = () => Object.assign(cxFechar, { open: true, contado: null, obs: '' });
  const diferencaFechamento = computed(() => cxFechar.contado == null || cxFechar.contado === '' || !resumoAtual.value ? null : round2(cxFechar.contado - resumoAtual.value.esperado));
  const fecharErro = computed(() => !atual.value ? 'Não há caixa aberto.' : !(cxFechar.contado >= 0) ? 'Conte o dinheiro da gaveta e informe o valor.'
    : diferencaFechamento.value !== 0 && !cxFechar.obs.trim() ? 'Explique a diferença no campo de observação.' : '');
  const fecharCaixa = async () => {
    if (fecharErro.value) return;
    if (!await db.executar(() => api.fecharCaixa({ contado: round2(cxFechar.contado), obs: cxFechar.obs.trim() }))) return;
    cxFechar.open = false; ui.notify('Caixa fechado.');
  };

  /* ---------- vendas ---------- */
  const vq = reactive({ tab: 'atual', periodo: 'hoje', busca: '', status: '' });
  const vendasLista = computed(() => {
    const desde = { hoje: todayIso, '7d': isoDate(addDays(startOfToday(), -6)), '30d': isoDate(addDays(startOfToday(), -29)), tudo: '' }[vq.periodo];
    const q = vq.busca.trim().toLowerCase(); const nomes = {}; state.clientes.forEach(c => { nomes[c.id] = nomeCompleto(c); });
    const status = s => s.status === 'cancelada' ? 'cancelada' : (s.devolucoes || []).length ? 'devolucao' : 'ok';
    return state.sales.filter(s => s.data >= desde && (!vq.status || status(s) === vq.status) && (!q || String(s.id).includes(q) || (nomes[s.clienteId] || '').toLowerCase().includes(q)))
      .slice().reverse().slice(0, LIMITE_LISTA).map(s => ({ s, cliente: nomes[s.clienteId] || '', status: status(s) }));
  });

  return { atual, resumoAtual, historico, cxAbrir, openAbrir, abrirErro, abrirCaixa, cxMov, openMov, movErro, salvarMov,
    cxFechar, openFechar, diferencaFechamento, fecharErro, fecharCaixa, vq, vendasLista };
});
