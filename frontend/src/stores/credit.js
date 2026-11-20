/* Crediário: parcelas, cobrança, recebimento com multa e juros, e regras. */
import { defineStore } from 'pinia';
import { reactive, computed } from 'vue';
import { round2, plusDays, diffDays, brl, dShort, todayIso, curMonth } from '@/domain/utils';
import { onlyDigits, nomeCompleto, matchCliente } from '@/domain/clients';
import { DEFAULT_CRED, credStatus as credStatusDe } from '@/domain/credit';
import { api } from '@/services/api';
import { useCaixaStore } from './caixa';
import { useDbStore } from './db';
import { useUiStore } from './ui';
import { useClientsStore } from './clients';
import { usePdvStore } from './pdv';

const DUE_SOON_DAYS = 7;

export const useCreditStore = defineStore('credit', () => {
  const db = useDbStore(); const ui = useUiStore(); const clients = useClientsStore();
  const state = db.state;

  const credStatus = c => credStatusDe(state, c, todayIso);
  const clientePorId = id => state.clientes.find(c => c.id === id);
  const detCred = computed(() => clients.cliDet ? credStatus(clients.cliDet) : null);
  const credParcelas = computed(() => state.crediarios.flatMap(cr => { const c = clientePorId(cr.clienteId);
    return cr.parcelas.filter(p => !p.canceladaEm).map(p => ({ key: cr.id + '-' + p.n, cr, p, c, nome: c ? nomeCompleto(c) : 'Cliente', qtd: cr.parcelas.length, atraso: !p.pagoEm && p.venc < todayIso ? diffDays(todayIso, p.venc) : 0 })); }));
  const credq = reactive({ filtro: 'atraso', busca: '' });
  const credLista = computed(() => { const q = credq.busca.trim(); const lim = plusDays(todayIso, DUE_SOON_DAYS);
    const filtros = { atraso: x => x.atraso > 0, semana: x => !x.p.pagoEm && x.p.venc >= todayIso && x.p.venc <= lim, aberto: x => !x.p.pagoEm, pagas: x => !!x.p.pagoEm && x.p.pagoEm.startsWith(curMonth) };
    const out = credParcelas.value.filter(x => (!q || (x.c && matchCliente(x.c, q)) || String(x.cr.vendaId).includes(q)) && filtros[credq.filtro](x));
    return credq.filtro === 'pagas' ? out.sort((a, b) => b.p.pagoEm.localeCompare(a.p.pagoEm)) : out.sort((a, b) => a.p.venc.localeCompare(b.p.venc)); });
  const credKpi = computed(() => { const lim = plusDays(todayIso, DUE_SOON_DAYS); const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
    const ab = credParcelas.value.filter(x => !x.p.pagoEm); const at = ab.filter(x => x.atraso > 0); const se = ab.filter(x => x.p.venc >= todayIso && x.p.venc <= lim);
    const pagasMes = credParcelas.value.filter(x => x.p.pagoEm && x.p.pagoEm.startsWith(curMonth));
    return { carteira: sum(ab, x => x.p.valor), parcelasAbertas: ab.length, atraso: sum(at, x => x.p.valor), atrasoQtd: at.length, clientesAtraso: new Set(at.map(x => x.cr.clienteId)).size,
      semana: sum(se, x => x.p.valor), semanaQtd: se.length, recebidoMes: sum(pagasMes, x => x.p.valorPago || x.p.valor), encargosMes: sum(pagasMes, x => Math.max(0, (x.p.valorPago || x.p.valor) - x.p.valor)) }; });
  const credClientes = computed(() => state.clientes.map(c => ({ c, ...credStatus(c) })).filter(x => x.emAberto > 0)
    .sort((a, b) => (b.atrasoDesde ? 1 : 0) - (a.atrasoDesde ? 1 : 0) || b.emAberto - a.emAberto));
  const waCobranca = x => `https://wa.me/55${onlyDigits(x.c.telefone)}?text=` + encodeURIComponent(`Oi, ${x.c.nome}! Passando para lembrar da parcela ${x.p.n}/${x.qtd} do seu crediário na Pocar Sport, de ${brl(x.p.valor)}, com vencimento em ${dShort(x.p.venc)}. Qualquer dúvida, estamos à disposição.`);

  /* ---------- recebimento de parcela ---------- */
  const receb = reactive({ open: false, credId: null, n: 0, forma: 'pix', encargos: true });
  const recebInfo = computed(() => { if (!receb.open) return null; const cr = state.crediarios.find(x => x.id === receb.credId); const p = cr && cr.parcelas.find(x => x.n === receb.n); if (!p) return null;
    const dias = Math.max(0, diffDays(todayIso, p.venc)); const multa = dias > 0 ? round2(p.valor * state.credCfg.multa / 100) : 0;
    const juros = dias > 0 ? round2(p.valor * state.credCfg.jurosMes / 100 * dias / 30) : 0; // juros pró-rata por dia de atraso
    const encargos = receb.encargos ? round2(multa + juros) : 0; const c = clientePorId(cr.clienteId);
    return { cr, p, dias, multa, juros, encargos, total: round2(p.valor + encargos), nome: c ? nomeCompleto(c) : 'Cliente' }; });
  const openReceber = (credId, n) => Object.assign(receb, { open: true, credId, n, forma: 'pix', encargos: true });
  const receberParcela = async () => { const info = recebInfo.value; if (!info || info.p.pagoEm) return;
    if (receb.forma === 'dinheiro' && !useCaixaStore().atual) { ui.notify('Abra o caixa para receber em dinheiro.'); return; }
    const r = await db.executar(() => api.receberParcela(info.cr.id, info.p.n, { forma: receb.forma, cobrarEncargos: receb.encargos }));
    if (!r) return;
    receb.open = false; ui.notify(`Parcela ${r.n}/${r.qtd} de ${r.nome} recebida: ${brl(r.total)}.`); };

  /* ---------- regras ---------- */
  const credRegras = reactive({ open: false, ...DEFAULT_CRED });
  const openCredRegras = () => Object.assign(credRegras, { ...state.credCfg, open: true });
  const credRegrasErro = computed(() => { const r = credRegras;
    if (!(Number.isInteger(r.maxParcelas) && r.maxParcelas >= 1 && r.maxParcelas <= 12)) return 'O máximo de parcelas vai de 1 a 12.';
    if (!(r.limitePadrao >= 0)) return 'Informe o limite padrão por cliente.';
    if (!(r.multa >= 0 && r.multa <= 2)) return 'A multa por atraso pode ir de 0% a 2%.';
    if (!(r.jurosMes >= 0 && r.jurosMes <= 10)) return 'Os juros por atraso vão de 0% a 10% ao mês.';
    if (!(r.primeiroVencDias >= 1 && r.primeiroVencDias <= 90)) return 'O 1º vencimento fica entre 1 e 90 dias.';
    return ''; });
  const salvarCredRegras = async () => { if (credRegrasErro.value) return; const { open, ...cfg } = credRegras;
    if (!await db.executar(() => api.regrasCrediario(cfg))) return;
    const pdvS = usePdvStore(); if (pdvS.pdv.credParcelas > cfg.maxParcelas) pdvS.pdv.credParcelas = cfg.maxParcelas;
    credRegras.open = false; ui.notify('Regras do crediário atualizadas.'); };

  return { credStatus, detCred, credq, credLista, credKpi, credClientes, waCobranca, receb, recebInfo, openReceber, receberParcela,
    credRegras, openCredRegras, credRegrasErro, salvarCredRegras };
});
