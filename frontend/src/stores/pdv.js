/* PDV: carrinho, cliente da venda, benefícios e crediário. Os valores aqui são a prévia da tela;
   ao finalizar, o servidor recalcula tudo, confere estoque, limite e benefícios e grava a venda. */
import { defineStore } from 'pinia';
import { ref, reactive, computed, watch } from 'vue';
import { OPERATOR } from '@/domain/constants';
import { round2, plusDays, dShort, brl, todayIso } from '@/domain/utils';
import { findVar, qtyAt } from '@/domain/products';
import { matchCliente } from '@/domain/clients';
import { beneficiosDe, cicloDe } from '@/domain/loyalty';
import { planoParcelas, credStatus } from '@/domain/credit';
import { api } from '@/services/api';
import { useDbStore } from './db';
import { useUiStore } from './ui';
import { useCatalogStore } from './catalog';
import { useGoalsStore } from './goals';
import { useCaixaStore } from './caixa';

const MAX_DISCOUNT_PCT = 30;

export const usePdvStore = defineStore('pdv', () => {
  const db = useDbStore(); const ui = useUiStore(); const catalog = useCatalogStore(); const goals = useGoalsStore(); const caixa = useCaixaStore();
  const state = db.state; const notify = ui.notify;
  const variantOf = sku => catalog.variantOf(sku);

  const pdv = reactive({ busca: '', cat: '', cart: [], vendedor: OPERATOR, clienteId: null, cliBusca: '', valesSel: [], usarCash: false, credEntrada: 0, credEntradaForma: 'pix', credParcelas: 3, credPrimeiro: plusDays(todayIso, state.credCfg.primeiroVencDias), desc: 0, descTipo: '%', pag: 'pix', parcelas: 1, recebido: null, troca: null });
  // Incrementado em "Nova venda" para a tela do PDV devolver o foco à busca.
  const focusTick = ref(0);

  /* ---------- cliente da venda ---------- */
  const pdvCliente = computed(() => state.clientes.find(c => c.id === pdv.clienteId) || null);
  const cliMatches = computed(() => { const q = pdv.cliBusca.trim(); return q.length < 2 ? [] : state.clientes.filter(c => matchCliente(c, q)).slice(0, 6); });
  const selCliente = c => { pdv.clienteId = c.id; pdv.cliBusca = ''; };
  const pdvBenef = computed(() => pdv.clienteId ? { ...beneficiosDe(state, pdv.clienteId, todayIso), ciclo: cicloDe(state, pdv.clienteId, todayIso) } : null);
  watch(() => pdv.clienteId, () => { pdv.valesSel = []; pdv.usarCash = false; });
  const credPdvCli = computed(() => pdvCliente.value ? credStatus(state, pdvCliente.value, todayIso) : null);

  /* ---------- produtos e carrinho ---------- */
  const pdvProdutos = computed(() => { const q = pdv.busca.trim().toLowerCase();
    return state.products.filter(p => (!pdv.cat || p.categoria === pdv.cat) && (!q || p.nome.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.variantes.some(v => v.sku.toLowerCase() === q || v.codigoBarras === q))); });
  const cartSub = computed(() => round2(pdv.cart.reduce((s, i) => s + i.preco * i.qtd, 0)));
  const cartPecas = computed(() => pdv.cart.reduce((s, i) => s + i.qtd, 0));
  const cartDesc = computed(() => { const d = Math.max(0, pdv.desc || 0); return round2(Math.min(cartSub.value, pdv.descTipo === '%' ? cartSub.value * d / 100 : d)); });
  const cartAposDesc = computed(() => round2(cartSub.value - cartDesc.value));
  const valeSelecionado = computed(() => pdvBenef.value ? pdvBenef.value.vales.filter(v => pdv.valesSel.includes(v.id)).reduce((t, v) => t + v.valor, 0) : 0);
  const cartVale = computed(() => round2(Math.min(valeSelecionado.value, cartAposDesc.value)));
  const valeSobra = computed(() => pdv.cart.length ? round2(valeSelecionado.value - cartVale.value) : 0);
  const cartCash = computed(() => pdv.usarCash && pdvBenef.value ? round2(Math.min(pdvBenef.value.cashSaldo, cartAposDesc.value - cartVale.value)) : 0);
  // Crédito das peças devolvidas numa troca, usado como pagamento desta venda.
  const cartTroca = computed(() => pdv.troca ? round2(Math.max(0, Math.min(pdv.troca.valor, cartAposDesc.value - cartVale.value - cartCash.value))) : 0);
  const trocaSobra = computed(() => pdv.troca && pdv.cart.length ? round2(pdv.troca.valor - cartTroca.value) : 0);
  const cartTotal = computed(() => round2(cartAposDesc.value - cartVale.value - cartCash.value - cartTroca.value));
  const credPlano = computed(() => { const fin = round2(Math.max(0, cartTotal.value - (pdv.credEntrada || 0)));
    return { financiado: fin, parcelas: planoParcelas(fin, pdv.credParcelas, pdv.credPrimeiro || todayIso) }; });

  const pdvErro = computed(() => {
    if (!pdv.cart.length) return '';
    if (!caixa.atual) return 'Abra o caixa para começar a vender.';
    if (trocaSobra.value > 0 && pdv.troca.sobraDestino === 'vale' && !pdvCliente.value) return 'Identifique o cliente para gerar o vale-troca da sobra.';
    if (pdv.pag === 'crediario') {
      if (!pdvCliente.value) return 'Selecione o cliente para vender no crediário.';
      const st = credPdvCli.value;
      if (st.atrasoDesde) return `Cliente com parcela atrasada desde ${dShort(st.atrasoDesde)}. Receba antes de vender no crediário.`;
      if ((pdv.credEntrada || 0) < 0) return 'A entrada não pode ser negativa.';
      if ((pdv.credEntrada || 0) >= cartTotal.value) return 'A entrada cobre a compra toda: escolha outra forma de pagamento.';
      if (credPlano.value.financiado > st.disponivel + 0.001) return `Valor parcelado acima do limite disponível (${brl(st.disponivel)}).`;
      if (!pdv.credPrimeiro || pdv.credPrimeiro < todayIso) return 'Informe a data do 1º vencimento.';
    }
    if (pdv.descTipo === '%' && pdv.desc > MAX_DISCOUNT_PCT) return 'Desconto acima de 30% precisa de aprovação do gerente.';
    if (pdv.pag === 'dinheiro' && (pdv.recebido || 0) < cartTotal.value) return 'Informe o valor recebido em dinheiro.';
    const semEstoque = pdv.cart.find(i => i.qtd > variantOf(i.sku).qtd);
    if (semEstoque) return `Estoque insuficiente de ${semEstoque.nome} ${semEstoque.tam}.`;
    return '';
  });

  /* ---------- escolha de tamanho e cor ---------- */
  const picker = reactive({ open: false, p: null, tam: '', cor: '', qtd: 1 });
  const availTam = t => picker.p && picker.p.variantes.some(v => v.tam === t && v.qtd > 0);
  const fixCor = () => { if (qtyAt(picker.p, picker.tam, picker.cor) === 0) { const v = picker.p.variantes.find(x => x.tam === picker.tam && x.qtd > 0); picker.cor = v ? v.cor : picker.cor; } picker.qtd = 1; };
  const inCart = sku => pdv.cart.find(i => i.sku === sku)?.qtd || 0;
  const pickerMax = computed(() => { if (!picker.p) return 0; const v = findVar(picker.p, picker.tam, picker.cor); return v ? v.qtd - inCart(v.sku) : 0; });
  const openPicker = p => { const v = p.variantes.find(x => x.qtd > 0) || p.variantes[0]; Object.assign(picker, { open: true, p, tam: v.tam, cor: v.cor, qtd: 1 }); };
  const pushCart = (p, v, qtd) => { const ex = pdv.cart.find(i => i.sku === v.sku);
    if (ex) ex.qtd += qtd; else pdv.cart.push({ sku: v.sku, pid: p.id, nome: p.nome, tam: v.tam, cor: v.cor, preco: p.preco, custo: p.custo, qtd }); };
  const addPicked = () => { const v = findVar(picker.p, picker.tam, picker.cor); if (!v || pickerMax.value < 1) return;
    pushCart(picker.p, v, Math.min(picker.qtd, pickerMax.value)); picker.open = false; notify(`${picker.p.nome} ${v.tam} adicionado.`); };
  const addBySku = () => { const q = pdv.busca.trim().toUpperCase(); const hit = catalog.variantIndex[q] || catalog.variantPorCodigo[q.replace(/\s/g, '')];
    if (!hit) { if (pdvProdutos.value.length === 1) openPicker(pdvProdutos.value[0]); return; }
    if (hit.v.qtd - inCart(hit.v.sku) < 1) { notify('Sem estoque para essa variação.'); return; }
    pushCart(hit.p, hit.v, 1); pdv.busca = ''; notify(`${hit.p.nome} ${hit.v.tam} adicionado pelo código.`); };
  const scrollCart = () => document.querySelector('.cart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const removeItem = it => { pdv.cart = pdv.cart.filter(i => i !== it); };
  const changeQty = (it, d) => { it.qtd += d; if (it.qtd <= 0) removeItem(it); };

  /* ---------- troca (vem da tela de devolução) ---------- */
  const iniciarTroca = t => {
    Object.assign(pdv, { cart: [], valesSel: [], usarCash: false, desc: 0, pag: 'pix', parcelas: 1, recebido: null, busca: '', cliBusca: '' });
    pdv.clienteId = t.clienteId || null;
    pdv.troca = { ...t, sobraDestino: t.clienteId ? 'vale' : 'dinheiro' };
  };
  const cancelarTroca = () => { pdv.troca = null; notify('Troca cancelada. Nenhuma peça foi devolvida.'); };

  /* ---------- finalização ---------- */
  const recibo = ref(null); const reciboAnim = ref(false);
  const finalizar = async () => {
    if (pdvErro.value || !pdv.cart.length) return;
    const pctAntes = goals.meta.pct;
    const troca = pdv.troca;
    const pedido = {
      itens: pdv.cart.map(i => ({ sku: i.sku, qtd: i.qtd })),
      clienteId: pdv.clienteId, desconto: pdv.desc || 0, descontoTipo: pdv.descTipo,
      valesIds: pdvBenef.value ? pdvBenef.value.vales.filter(v => pdv.valesSel.includes(v.id)).map(v => v.id) : [],
      usarCashback: !!(pdv.usarCash && pdvBenef.value), pagamento: pdv.pag,
      parcelas: pdv.pag === 'credito' ? pdv.parcelas : 1, recebido: pdv.pag === 'dinheiro' ? pdv.recebido : null,
      crediario: pdv.pag === 'crediario' ? { entrada: round2(pdv.credEntrada || 0), entradaForma: pdv.credEntradaForma, parcelas: pdv.credParcelas, primeiroVenc: pdv.credPrimeiro } : null,
      troca: troca ? { vendaId: troca.vendaId, qtds: troca.qtds, motivo: troca.motivo, sobraDestino: troca.sobraDestino } : null,
    };
    const r = await db.executar(() => api.vender(pedido));
    if (!r) return;
    pdv.troca = null; pdv.cart = [];
    recibo.value = { ...r, pctAntes };
    reciboAnim.value = false;
    requestAnimationFrame(() => requestAnimationFrame(() => reciboAnim.value = true));
  };
  const novaVenda = () => { recibo.value = null; Object.assign(pdv, { cart: [], clienteId: null, cliBusca: '', valesSel: [], usarCash: false, credEntrada: 0, credParcelas: Math.min(3, state.credCfg.maxParcelas), credPrimeiro: plusDays(todayIso, state.credCfg.primeiroVencDias), desc: 0, pag: 'pix', parcelas: 1, recebido: null, busca: '', troca: null }); focusTick.value++; };

  return { pdv, focusTick, pdvCliente, cliMatches, selCliente, pdvBenef, credPdvCli,
    pdvProdutos, cartSub, cartPecas, cartDesc, cartVale, valeSobra, cartCash, cartTroca, trocaSobra, cartTotal, credPlano, pdvErro, iniciarTroca, cancelarTroca,
    picker, availTam, fixCor, pickerMax, openPicker, addPicked, addBySku, scrollCart, changeQty, removeItem,
    recibo, reciboAnim, finalizar, novaVenda };
});
