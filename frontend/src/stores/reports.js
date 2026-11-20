/* Exportação do relatório financeiro em PDF: período, regime e prévia dos totais. */
import { defineStore } from 'pinia';
import { reactive, computed } from 'vue';
import { pad, daysInMonth, shiftMonth, monthName, cap, diffDays } from '@/domain/utils';
import { montarRelatorioFinanceiro } from '@/domain/relatorios';
import { baixarRelatorioFinanceiro } from '@/services/relatorios';
import { useDbStore } from './db';
import { useUiStore } from './ui';
import { useFinanceStore } from './finance';
import { useSessionStore } from './session';
import { useAuditStore } from './audit';

const MAX_DIAS = 731; // até 2 anos por relatório
const fimDoMes = m => `${m}-${pad(daysInMonth(m))}`;

export const useReportsStore = defineStore('reports', () => {
  const db = useDbStore(); const ui = useUiStore(); const finance = useFinanceStore();

  const rel = reactive({ open: false, preset: 'mes', inicio: '', fim: '', regime: 'caixa', incluirAbertos: true, agruparPorDia: true, gerando: false });
  const presets = computed(() => { const m = finance.fin.mes;
    return [{ id: 'mes', label: cap(monthName(m, true)) }, { id: 'anterior', label: cap(monthName(shiftMonth(m, -1), true)) },
      { id: 'tri', label: 'Últimos 3 meses' }, { id: 'ano', label: `Ano de ${m.slice(0, 4)}` }]; });
  const aplicarPreset = id => { const m = finance.fin.mes;
    const faixas = { mes: [`${m}-01`, fimDoMes(m)], anterior: [`${shiftMonth(m, -1)}-01`, fimDoMes(shiftMonth(m, -1))],
      tri: [`${shiftMonth(m, -2)}-01`, fimDoMes(m)], ano: [`${m.slice(0, 4)}-01-01`, `${m.slice(0, 4)}-12-31`] };
    [rel.inicio, rel.fim] = faixas[id]; rel.preset = id; };
  /* Abre já com o mês que está na tela do financeiro. */
  const openRelatorio = () => { aplicarPreset('mes'); Object.assign(rel, { open: true, gerando: false }); };

  const relErro = computed(() => {
    if (!rel.inicio || !rel.fim) return 'Informe o período.';
    if (rel.inicio > rel.fim) return 'A data inicial está depois da final.';
    if (diffDays(rel.fim, rel.inicio) > MAX_DIAS) return 'Escolha um período de até 2 anos.';
    return ''; });
  const filtros = () => ({ inicio: rel.inicio, fim: rel.fim, regime: rel.regime, incluirAbertos: rel.incluirAbertos, agruparPorDia: rel.agruparPorDia });
  const previa = computed(() => rel.open && !relErro.value ? montarRelatorioFinanceiro(db.state, filtros()) : null);

  const gerarRelatorio = async () => {
    if (relErro.value || rel.gerando) return;
    rel.gerando = true;
    try {
      const arquivo = await baixarRelatorioFinanceiro(db.state, filtros(), { loja: 'Pocar Sport', emitidoPor: useSessionStore().usuario });
      useAuditStore().registrar('Relatório financeiro exportado', `${rel.inicio} a ${rel.fim}, regime de ${rel.regime === 'caixa' ? 'caixa' : 'competência'}`);
      rel.open = false; ui.notify(`Relatório baixado: ${arquivo}`);
    } catch (e) {
      console.error('Falha ao gerar o relatório financeiro', e);
      ui.notify('Não foi possível gerar o PDF. Tente de novo.');
    } finally { rel.gerando = false; }
  };

  return { rel, presets, aplicarPreset, openRelatorio, relErro, previa, gerarRelatorio };
});
