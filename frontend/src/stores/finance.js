/* Financeiro: fluxo de caixa, contas a pagar e receber, lucro mensal, DRE e lançamentos manuais. */
import { defineStore } from 'pinia';
import { reactive, computed, watch } from 'vue';
import { CAT_DESP, CAT_REC } from '@/domain/constants';
import { round2, pad, isoDate, addDays, startOfToday, daysInMonth, shiftMonth, monthName, todayIso, curMonth } from '@/domain/utils';
import { calcResultado, calcResultadoPeriodo, semanasDoPeriodo } from '@/domain/finance';
import { brl } from '@/domain/utils';
import { useDbStore } from './db';
import { useUiStore } from './ui';
import { useGoalsStore } from './goals';
import { useCreditStore } from './credit';
import { api } from '@/services/api';

const PAGE_SIZE = 40;
const REC_PAGE_SIZE = 12;

export const useFinanceStore = defineStore('finance', () => {
  const db = useDbStore(); const ui = useUiStore(); const goals = useGoalsStore(); const credit = useCreditStore();
  const state = db.state; const notify = ui.notify;

  const fin = reactive({ mes: curMonth, tab: 'fluxo', filtro: '', limite: PAGE_SIZE, limiteRec: REC_PAGE_SIZE });
  const shiftFin = n => { const m = shiftMonth(fin.mes, n); if (m <= curMonth) { fin.mes = m; fin.limite = PAGE_SIZE; } };
  const caixaMes = m => { const pagos = state.lanc.filter(l => l.status === 'pago' && l.pagoEm && l.pagoEm.startsWith(m));
    const entradas = pagos.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0); const saidas = pagos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
    return { entradas, saidas, saldo: entradas - saidas }; };
  const finMes = computed(() => caixaMes(fin.mes));
  const finCur = computed(() => caixaMes(curMonth));
  const lancMes = computed(() => state.lanc.filter(l => (l.status === 'pago' ? l.pagoEm : l.venc).startsWith(fin.mes) && (!fin.filtro || l.tipo === fin.filtro))
    .sort((a, b) => a.status !== b.status ? (a.status === 'pago' ? -1 : 1) : a.status === 'pago' ? (b.pagoEm.localeCompare(a.pagoEm) || b.id - a.id) : a.venc.localeCompare(b.venc)));
  const pendentes = computed(() => state.lanc.filter(l => l.status === 'pendente').sort((a, b) => a.venc.localeCompare(b.venc)));
  const contasPagar = computed(() => pendentes.value.filter(l => l.tipo === 'despesa'));
  const contasReceber = computed(() => pendentes.value.filter(l => l.tipo === 'receita'));
  const abertos = computed(() => ({ pagar: contasPagar.value.reduce((s, l) => s + l.valor, 0), receber: contasReceber.value.reduce((s, l) => s + l.valor, 0) }));
  const contasProx = computed(() => { const lim = isoDate(addDays(startOfToday(), 7)); return pendentes.value.filter(l => l.venc <= lim && (l.tipo === 'despesa' || l.venc <= todayIso)); });
  /* Parcela de crediário abre a tela de recebimento (com multa e juros); o resto é baixado direto. */
  const baixar = async l => { if (l.credId && l.parcela) { credit.openReceber(l.credId, l.parcela); return; }
    if (!await db.executar(() => api.baixar(l.id))) return;
    notify(`${l.tipo === 'despesa' ? 'Pagamento' : 'Recebimento'} registrado: ${l.descricao}.`); };
  const fluxoDias = computed(() => { const n = daysInMonth(fin.mes);
    return Array.from({ length: n }, (_, i) => { const k = `${fin.mes}-${pad(i + 1)}`; const pg = state.lanc.filter(l => l.status === 'pago' && l.pagoEm === k);
      return { dia: k, ent: pg.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0), sai: pg.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0) }; }); });
  const fluxoMax = computed(() => Math.max(1, ...fluxoDias.value.flatMap(d => [d.ent, d.sai])));
  const dre = computed(() => { const r = calcResultado(state, fin.mes); return { ...r, bruta: r.bruta || 0.0001 }; });

  /* ---------- lançamento manual ---------- */
  const lanc = reactive({ open: false, tipo: 'despesa', descricao: '', categoria: CAT_DESP[0], valor: null, venc: todayIso, status: 'pendente' });
  watch(() => lanc.tipo, t => { lanc.categoria = (t === 'despesa' ? CAT_DESP : CAT_REC)[0]; });
  const openLanc = () => Object.assign(lanc, { open: true, descricao: '', valor: null, venc: todayIso, status: 'pendente' });
  const salvarLanc = async () => {
    const p = { tipo: lanc.tipo, descricao: lanc.descricao.trim(), categoria: lanc.categoria, valor: round2(lanc.valor), venc: lanc.venc, status: lanc.status };
    if (!await db.executar(() => api.lancamento(p))) return;
    lanc.open = false; notify('Lançamento salvo.');
  };

  /* ---------- lucro mensal e fechamento ---------- */
  const lucroMeses = computed(() => { const out = []; const first = Object.keys(state.metas).sort()[0] || curMonth;
    for (let m = first; m <= curMonth; m = shiftMonth(m, 1)) { const snap = state.fechamentos[m];
      out.push({ ...(snap || calcResultado(state, m)), mes: m, fechado: !!snap, fechadoEm: snap ? snap.fechadoEm : '', obs: snap ? snap.obs : '', parcial: m === curMonth }); }
    return out.reverse(); });
  const lucroAtual = computed(() => { const r = calcResultado(state, curMonth);
    // projeta só a parte variável (vendas); as despesas fixas do mês já estão lançadas por inteiro
    const fator = goals.meta.realizado > 0 ? goals.meta.projecao / goals.meta.realizado : 1;
    return { ...r, projetado: r.lucroBruto * fator - r.totalDespesas }; });
  /* ---------- lucro por período, semana a semana ---------- */
  const segundaDe = iso => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); };
  const menosDias = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const lucroFiltro = reactive({ ini: menosDias(segundaDe(todayIso), 7 * 7), fim: todayIso }); // padrão: as últimas 8 semanas
  const atalhosLucro = [
    { id: '4s', label: 'Últimas 4 semanas', ini: () => menosDias(segundaDe(todayIso), 21) },
    { id: '8s', label: 'Últimas 8 semanas', ini: () => menosDias(segundaDe(todayIso), 49) },
    { id: 'mes', label: 'Este mês', ini: () => curMonth + '-01' },
    { id: '3m', label: 'Últimos 3 meses', ini: () => shiftMonth(curMonth, -2) + '-01' },
  ];
  const usarAtalhoLucro = a => Object.assign(lucroFiltro, { ini: a.ini(), fim: todayIso });
  const lucroPeriodoValido = computed(() => !!lucroFiltro.ini && !!lucroFiltro.fim && lucroFiltro.ini <= lucroFiltro.fim);
  const lucroPeriodo = computed(() => lucroPeriodoValido.value ? calcResultadoPeriodo(state, lucroFiltro.ini, lucroFiltro.fim) : null);
  const lucroSemanas = computed(() => lucroPeriodoValido.value
    ? semanasDoPeriodo(lucroFiltro.ini, lucroFiltro.fim).map(w => ({ ...w, ...calcResultadoPeriodo(state, w.ini, w.fim), atual: w.fim >= todayIso && w.ini <= todayIso })).reverse()
    : []);

  /* ---------- despesas fixas: o servidor cria a conta de cada mês no dia escolhido ---------- */
  const fixa = reactive({ open: false, id: null, descricao: '', categoria: 'Ocupação', valor: null, dia: 10, ativa: true });
  const openFixa = d => Object.assign(fixa, d ? { open: true, ...d } : { open: true, id: null, descricao: '', categoria: 'Ocupação', valor: null, dia: 10, ativa: true });
  const fixaErro = computed(() => !fixa.descricao.trim() ? 'Informe a descrição.' : !(fixa.valor > 0) ? 'Informe o valor mensal.'
    : !(Number.isInteger(fixa.dia) && fixa.dia >= 1 && fixa.dia <= 31) ? 'O dia do pagamento vai de 1 a 31.' : '');
  const salvarFixa = async () => {
    if (fixaErro.value) return;
    const p = { descricao: fixa.descricao.trim(), categoria: fixa.categoria, valor: round2(fixa.valor), dia: fixa.dia, ativa: fixa.ativa };
    if (!await db.executar(() => api.despesaFixa(fixa.id, p))) return;
    fixa.open = false; notify(fixa.id ? 'Despesa fixa atualizada.' : `Despesa fixa criada. A conta de cada mês vence todo dia ${p.dia}.`);
  };
  const alternarFixa = async d => {
    if (!await db.executar(() => api.despesaFixa(d.id, { descricao: d.descricao, categoria: d.categoria, valor: d.valor, dia: d.dia, ativa: !d.ativa }))) return;
    notify(d.ativa ? `${d.descricao} desativada: as contas em aberto deste mês em diante foram canceladas.` : `${d.descricao} reativada.`);
  };
  const proximaFixa = d => { const vencEm = m => { const dias = daysInMonth(m); return `${m}-${pad(Math.min(d.dia, dias))}`; };
    const esteMes = vencEm(curMonth); return esteMes >= todayIso ? esteMes : vencEm(shiftMonth(curMonth, 1)); };

  const fechamento = reactive({ open: false, mes: '', obs: '' });
  const fechamentoPrev = computed(() => calcResultado(state, fechamento.mes || curMonth));
  const openFechamento = m => Object.assign(fechamento, { open: true, mes: m, obs: '' });
  const salvarFechamento = async () => {
    if (!await db.executar(() => api.fecharMes(fechamento.mes, fechamento.obs.trim()))) return;
    fechamento.open = false; notify(`Lucro de ${monthName(fechamento.mes)} registrado.`); };

  return { fin, shiftFin, finMes, finCur, lancMes, contasPagar, contasReceber, abertos, contasProx, baixar, fluxoDias, fluxoMax, dre,
    lanc, openLanc, salvarLanc, lucroMeses, lucroAtual, fechamento, fechamentoPrev, openFechamento, salvarFechamento,
    lucroFiltro, atalhosLucro, usarAtalhoLucro, lucroPeriodoValido, lucroPeriodo, lucroSemanas,
    fixa, openFixa, fixaErro, salvarFixa, alternarFixa, proximaFixa };
});
