/* Vendas do mês e metas: contador da meta, gráficos e edição da meta da loja. */
import { defineStore } from 'pinia';
import { reactive, computed } from 'vue';
import { PAY_LABEL } from '@/domain/constants';
import { pad, isoDate, addDays, startOfToday, daysInMonth, sumTotal, todayIso, curMonth } from '@/domain/utils';
import { vendaValida, faturamento } from '@/domain/sales';
import { brl } from '@/domain/utils';
import { api } from '@/services/api';
import { useDbStore } from './db';
import { useUiStore } from './ui';

const CHART_BASE_Y = 190;
const CHART_HEIGHT = 166;

export const useGoalsStore = defineStore('goals', () => {
  const db = useDbStore(); const ui = useUiStore();
  const state = db.state; const salesOfMonth = db.salesOfMonth;

  // Faturamento líquido: vendas válidas menos o que foi devolvido em dinheiro.
  const mesAtual = computed(() => { const s = salesOfMonth(curMonth); const t = faturamento(state.sales, curMonth); return { total: t, qtd: s.length, ticket: s.length ? t / s.length : 0 }; });
  const hoje = computed(() => { const s = state.sales.filter(x => x.data.startsWith(todayIso) && vendaValida(x)); const t = faturamento(state.sales, todayIso);
    return { total: t, qtd: s.length, ticket: s.length ? t / s.length : 0, pecas: s.reduce((a, x) => a + x.itens.reduce((b, i) => b + i.qtd, 0), 0) }; });
  const meta = computed(() => {
    const alvo = state.metas[curMonth] || 0; const realizado = mesAtual.value.total;
    const dim = daysInMonth(curMonth); const dom = +todayIso.slice(8); const diasRest = dim - dom + 1;
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const elapsed = dom - 1 + Math.min(1, Math.max(0.15, (h - 9) / 10)); // dia de hoje conta só a parte já aberta
    const media = realizado / elapsed; const falta = Math.max(0, alvo - realizado);
    const idealPct = (dom - 0.5) / dim;
    return { alvo, realizado, pct: alvo ? realizado / alvo : 0, dim, dom, diasRest, media, falta, porDia: falta / diasRest,
      projecao: media * dim, idealPct, idealValor: alvo * idealPct, metaDia: alvo / dim };
  });
  const last14 = computed(() => Array.from({ length: 14 }, (_, i) => { const d = addDays(startOfToday(), i - 13); const k = isoDate(d);
    return { dia: k, total: faturamento(state.sales, k), short: d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0,3), label: d.toLocaleDateString('pt-BR') }; }));
  const last14Max = computed(() => Math.max(meta.value.metaDia * 1.25, ...last14.value.map(d => d.total)) || 1);
  const barY = (v, max) => CHART_BASE_Y - (v / max) * CHART_HEIGHT;
  const topProdutos = computed(() => { const m = {}; salesOfMonth(curMonth).forEach(s => s.itens.forEach(i => m[i.nome] = (m[i.nome] || 0) + i.qtd));
    return Object.entries(m).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd); });
  const payMix = computed(() => { const s = salesOfMonth(curMonth); const tot = sumTotal(s) || 1;
    return Object.keys(PAY_LABEL).map(k => { const t = sumTotal(s.filter(x => x.pagamento === k)); return { k, label: PAY_LABEL[k], total: t, share: t / tot }; }).sort((a, b) => b.total - a.total); });
  const cumulado = computed(() => { const out = []; let acc = 0; for (let d = 1; d <= meta.value.dom; d++) { const k = `${curMonth}-${pad(d)}`; acc += faturamento(state.sales, k); out.push(acc); } return out; });
  const cumMax = computed(() => Math.max(meta.value.alvo, ...cumulado.value) * 1.05 || 1);
  const cumX = d => 40 + (d / meta.value.dim) * 580;
  const cumY = v => 210 - (v / cumMax.value) * 190;
  const cumPoints = computed(() => ['40,210', ...cumulado.value.map((v, i) => `${cumX(i + 1)},${cumY(v)}`)].join(' '));
  const historico = computed(() => Object.keys(state.metas).sort().reverse().map(m => ({ mes: m, alvo: state.metas[m], realizado: faturamento(state.sales, m) })));

  /* ---------- edição de metas ---------- */
  const metasEd = reactive({ open: false, loja: 0, vend: {} });
  const openMetas = () => Object.assign(metasEd, { open: true, loja: state.metas[curMonth] });
  const salvarMetas = async () => {
    if (!await db.executar(() => api.meta(curMonth, metasEd.loja))) return;
    metasEd.open = false; ui.notify('Meta atualizada.'); };

  return { mesAtual, hoje, meta, last14, last14Max, barY, topProdutos, payMix, cumulado, cumX, cumY, cumPoints, historico, metasEd, openMetas, salvarMetas };
});
