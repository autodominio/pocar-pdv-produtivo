/* Tela e regras do programa de fidelidade. */
import { defineStore } from 'pinia';
import { reactive, computed } from 'vue';
import { round2, plusDays, brl, dShort, todayIso, curMonth } from '@/domain/utils';
import { onlyDigits, nomeCompleto, matchCliente } from '@/domain/clients';
import { DEFAULT_FID, beneficiosDe, cicloDe } from '@/domain/loyalty';
import { useDbStore } from './db';
import { useUiStore } from './ui';
import { useClientsStore } from './clients';
import { api } from '@/services/api';
import { vendaValida } from '@/domain/sales';

const FID_NEAR = 0.7;
const FID_EXPIRY_DAYS = 7;
const EXTRATO_LIMIT = 20;

export const useLoyaltyStore = defineStore('loyalty', () => {
  const db = useDbStore(); const ui = useUiStore(); const clients = useClientsStore();
  const state = db.state; const salesOfMonth = db.salesOfMonth;

  const detBenef = computed(() => clients.cliDet ? { ...beneficiosDe(state, clients.cliDet.id, todayIso), ciclo: cicloDe(state, clients.cliDet.id, todayIso) } : null);
  const benefTotal = c => { const b = beneficiosDe(state, c.id, todayIso); return round2(b.vales.reduce((t, v) => t + v.valor, 0) + b.cashSaldo); };
  const fidKpi = computed(() => { const m = curMonth; const vm = salesOfMonth(m);
    const ativosV = state.vales.filter(v => !v.usadoEm && !v.canceladoEm && v.validade >= todayIso); const ativosC = state.cashbacks.filter(c => c.saldo > 0.009 && c.validade >= todayIso);
    const cashAtivo = ativosC.reduce((t, c) => t + c.saldo, 0);
    return { valesEmitidos: state.vales.filter(v => v.emitidoEm.startsWith(m)).length, valesUsados: state.vales.filter(v => v.usadoEm && v.usadoEm.startsWith(m)).length,
      valesUsadosValor: vm.reduce((t, x) => t + (x.valeUsado || 0), 0), cashGerado: state.cashbacks.filter(c => c.geradoEm.startsWith(m)).reduce((t, c) => t + c.valor, 0),
      cashUsado: vm.reduce((t, x) => t + (x.cashbackUsado || 0), 0), valesAtivos: ativosV.length, cashAtivo, passivo: ativosV.reduce((t, v) => t + v.valor, 0) + cashAtivo }; });

  /* ---------- regras ---------- */
  const regras = reactive({ open: false, ...DEFAULT_FID });
  const openRegras = () => Object.assign(regras, { ...state.fid, open: true });
  const regrasErro = computed(() => {
    if (regras.valeAtivo) { if (!(regras.valeMeta > 0)) return 'Informe o valor de compras para ganhar o vale.';
      if (!(regras.valePrazo >= 1)) return 'O prazo para acumular precisa ser de pelo menos 1 dia.';
      if (!(regras.valeValor > 0) || regras.valeValor >= regras.valeMeta) return 'O vale precisa ser maior que zero e menor que o valor de compras exigido.';
      if (!(regras.valeValidade >= 1)) return 'A validade do vale precisa ser de pelo menos 1 dia.'; }
    if (regras.cashAtivo) { if (!(regras.cashPct >= 1 && regras.cashPct <= 50)) return 'O cashback precisa ficar entre 1% e 50%.';
      if (!(regras.cashValidade >= 1)) return 'A validade do cashback precisa ser de pelo menos 1 dia.'; }
    return ''; });
  const salvarRegras = async () => { if (regrasErro.value) return; const { open, ...cfg } = regras;
    if (!await db.executar(() => api.regrasFidelidade(cfg))) return;
    regras.open = false; ui.notify('Regras de fidelidade atualizadas.'); };

  /* ---------- clientes no programa ---------- */
  const fidClientes = computed(() => { const lim = plusDays(todayIso, FID_EXPIRY_DAYS);
    return state.clientes.map(c => { const b = beneficiosDe(state, c.id, todayIso); const ciclo = cicloDe(state, c.id, todayIso);
      const datas = [...b.vales.map(v => v.validade), ...(b.cashSaldo > 0 ? [b.cashValidade] : [])].sort();
      return { c, vales: b.vales, valesTotal: b.vales.reduce((t, v) => t + v.valor, 0), cashSaldo: b.cashSaldo, cashValidade: b.cashValidade, ciclo,
        prog: state.fid.valeAtivo ? ciclo.acumulado / state.fid.valeMeta : 0, proxVenc: datas[0] || '', vencendo: !!datas[0] && datas[0] <= lim }; }); });
  const fidq = reactive({ busca: '', filtro: '' });
  const fidLista = computed(() => { const q = fidq.busca.trim();
    return fidClientes.value.filter(x => (!q || matchCliente(x.c, q)) && (fidq.filtro !== 'perto' || x.prog >= FID_NEAR) && (fidq.filtro !== 'vale' || x.vales.length) && (fidq.filtro !== 'vencendo' || x.vencendo))
      .sort((a, b) => b.prog - a.prog || (b.valesTotal + b.cashSaldo) - (a.valesTotal + a.cashSaldo)); });
  const fidResumo = computed(() => ({ participando: fidClientes.value.filter(x => x.ciclo.acumulado > 0 || x.vales.length || x.cashSaldo > 0).length,
    perto: fidClientes.value.filter(x => x.prog >= FID_NEAR).length, vencendo: fidClientes.value.filter(x => x.vencendo).length }));
  const fidExtrato = computed(() => { const nomes = {}; state.clientes.forEach(c => nomes[c.id] = nomeCompleto(c)); const nome = id => nomes[id] || 'Cliente'; const ev = [];
    state.vales.filter(v => !v.canceladoEm).forEach(v => { ev.push({ k: 've' + v.id, data: v.emitidoEm, tipo: v.origem ? 'Vale-troca' : 'Vale-compras ganho', cliente: nome(v.clienteId), valor: v.valor, sinal: '+' });
      if (v.usadoEm) ev.push({ k: 'vu' + v.id, data: v.usadoEm, tipo: 'Vale-compras usado', cliente: nome(v.clienteId), valor: v.valor, sinal: '−' }); });
    state.cashbacks.forEach(c => ev.push({ k: 'cg' + c.id, data: c.geradoEm, tipo: 'Cashback ganho', cliente: nome(c.clienteId), valor: c.valor, sinal: '+' }));
    state.sales.forEach(x => { if (x.cashbackUsado > 0 && vendaValida(x)) ev.push({ k: 'cu' + x.id, data: x.data.slice(0, 10), tipo: 'Cashback usado', cliente: nome(x.clienteId), valor: x.cashbackUsado, sinal: '−' }); });
    return ev.sort((a, b) => b.data.localeCompare(a.data)).slice(0, EXTRATO_LIMIT); });
  const waAviso = x => { const partes = [];
    if (x.valesTotal) partes.push(`${brl(x.valesTotal)} em vale-compras`); if (x.cashSaldo > 0) partes.push(`${brl(x.cashSaldo)} de cashback`);
    return `https://wa.me/55${onlyDigits(x.c.telefone)}?text=` + encodeURIComponent(`Oi, ${x.c.nome}! Você tem ${partes.join(' e ')} para usar na Pocar Sport, válido até ${dShort(x.proxVenc)}. Passa na loja!`); };

  return { detBenef, benefTotal, fidKpi, regras, openRegras, regrasErro, salvarRegras, fidq, fidLista, fidResumo, fidExtrato, waAviso };
});
