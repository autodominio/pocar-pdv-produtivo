/* Clientes: lista, aniversariantes, ficha e cadastro. */
import { defineStore } from 'pinia';
import { ref, reactive, computed } from 'vue';
import { isoDate, addDays, startOfToday, sumTotal, todayIso, curMonth } from '@/domain/utils';
import { INACTIVE_DAYS, onlyDigits, fone, nomeCompleto, idade, anivMes, anivHoje, matchCliente } from '@/domain/clients';
import { useDbStore } from './db';
import { useUiStore } from './ui';
import { usePdvStore } from './pdv';
import { api } from '@/services/api';
import { vendaValida } from '@/domain/sales';

const EMPTY_STATS = { qtd: 0, total: 0, ultima: '' };

export const useClientsStore = defineStore('clients', () => {
  const db = useDbStore(); const ui = useUiStore();
  const state = db.state; const salesOfMonth = db.salesOfMonth;

  const cliStats = computed(() => { const m = {}; state.sales.forEach(s => { if (!s.clienteId || !vendaValida(s)) return;
    const x = m[s.clienteId] || (m[s.clienteId] = { qtd: 0, total: 0, ultima: '' }); x.qtd++; x.total += s.total; if (s.data > x.ultima) x.ultima = s.data; }); return m; });
  const statOf = c => cliStats.value[c.id] || EMPTY_STATS;
  const cliq = reactive({ busca: '', filtro: '' });
  const clientesFiltrados = computed(() => { const q = cliq.busca.trim(); const lim = isoDate(addDays(startOfToday(), -INACTIVE_DAYS));
    return state.clientes.filter(c => (!q || matchCliente(c, q)) && (cliq.filtro !== 'aniv' || anivMes(c)) && (cliq.filtro !== 'inativos' || statOf(c).ultima < lim))
      .sort((a, b) => nomeCompleto(a).localeCompare(nomeCompleto(b), 'pt-BR')); });
  const aniversariantes = computed(() => state.clientes.filter(anivMes).sort((a, b) => a.nascimento.slice(8).localeCompare(b.nascimento.slice(8))));
  const cliKpi = computed(() => { const vm = salesOfMonth(curMonth); const com = vm.filter(s => s.clienteId); const sem = vm.filter(s => !s.clienteId);
    return { novos: state.clientes.filter(c => c.criadoEm.startsWith(curMonth)).length, compraram: new Set(com.map(s => s.clienteId)).size,
      identificadas: vm.length ? com.length / vm.length : 0, ticketCom: com.length ? sumTotal(com) / com.length : 0,
      ticketSem: sem.length ? sumTotal(sem) / sem.length : 0, anivHoje: state.clientes.filter(anivHoje).length }; });

  /* ---------- ficha ---------- */
  const cliDet = ref(null);
  const cliHistorico = computed(() => cliDet.value ? state.sales.filter(s => s.clienteId === cliDet.value.id).slice().reverse() : []);

  /* ---------- cadastro ---------- */
  const cliForm = reactive({ open: false, id: null, nome: '', sobrenome: '', telefone: '', nascimento: '', limite: '', tentou: false, paraPdv: false });
  const onFone = e => { cliForm.telefone = fone(e.target.value); e.target.value = cliForm.telefone; };
  const cliErros = computed(() => { const e = {}; const d = onlyDigits(cliForm.telefone);
    if (cliForm.nome.trim().length < 2) e.nome = 'Informe o nome.';
    if (cliForm.sobrenome.trim().length < 2) e.sobrenome = 'Informe o sobrenome.';
    if (d.length < 10) e.telefone = 'Informe o telefone com DDD (10 ou 11 dígitos).';
    else if (d.length === 11 && d[2] !== '9') e.telefone = 'Celular com 11 dígitos começa com 9 depois do DDD.';
    else { const dup = state.clientes.find(c => c.telefone === d && c.id !== cliForm.id); if (dup) e.telefone = `Este telefone já é de ${nomeCompleto(dup)}.`; }
    if (!cliForm.nascimento) e.nascimento = 'Informe a data de nascimento.';
    else if (cliForm.nascimento > todayIso) e.nascimento = 'A data não pode estar no futuro.';
    else if (idade(cliForm.nascimento) > 110) e.nascimento = 'Confira o ano de nascimento.';
    return e; });
  /* paraPdv: cadastro aberto pelo PDV; ao salvar, o cliente já fica selecionado na venda. */
  const openCliente = (c, paraPdv) => {
    if (c) Object.assign(cliForm, { id: c.id, nome: c.nome, sobrenome: c.sobrenome, telefone: fone(c.telefone), nascimento: c.nascimento, limite: c.limite == null ? '' : c.limite });
    else { // aproveita o que já foi digitado na busca
      const q = (paraPdv ? usePdvStore().pdv.cliBusca : cliq.busca).trim(); const isFone = onlyDigits(q).length >= 3 && !/[A-Za-zÀ-ÿ]/.test(q);
      const partes = isFone ? [] : q.split(/\s+/).filter(Boolean);
      Object.assign(cliForm, { id: null, nome: partes[0] || '', sobrenome: partes.slice(1).join(' '), telefone: isFone ? fone(q) : '', nascimento: '', limite: '' }); }
    Object.assign(cliForm, { open: true, tentou: false, paraPdv: !!paraPdv });
  };
  const salvarCliente = async () => {
    cliForm.tentou = true; if (Object.keys(cliErros.value).length) return;
    const dados = { nome: cliForm.nome.trim().replace(/\s+/g, ' '), sobrenome: cliForm.sobrenome.trim().replace(/\s+/g, ' '), telefone: onlyDigits(cliForm.telefone), nascimento: cliForm.nascimento,
      limite: cliForm.limite === '' || cliForm.limite == null ? null : Math.max(0, Number(cliForm.limite)) };
    const editando = !!cliForm.id;
    const r = await db.executar(() => api.salvarCliente(cliForm.id, dados));
    if (!r) return;
    const c = state.clientes.find(x => x.id === r.id) || { ...dados, id: r.id };
    if (cliDet.value && cliDet.value.id === c.id) cliDet.value = c; // ficha aberta mostra o cadastro novo
    cliForm.open = false;
    if (cliForm.paraPdv) usePdvStore().selCliente(c);
    ui.notify(editando ? 'Cadastro atualizado.' : `${nomeCompleto(c)} cadastrado(a).`);
  };

  return { cliStats, statOf, cliq, clientesFiltrados, aniversariantes, cliKpi, cliDet, cliHistorico, cliForm, onFone, cliErros, openCliente, salvarCliente };
});
