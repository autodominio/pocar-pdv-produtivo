/* Estoque: produtos, variações, entrada de mercadoria e cadastro de produto. */
import { defineStore } from 'pinia';
import { reactive, computed } from 'vue';
import { DEFAULT_MIN_STOCK } from '@/domain/constants';
import { brl } from '@/domain/utils';
import { round2, isoDate, addDays, startOfToday } from '@/domain/utils';
import { useDbStore } from './db';
import { useUiStore } from './ui';
import { api } from '@/services/api';
import { vendaValida } from '@/domain/sales';

export const useCatalogStore = defineStore('catalog', () => {
  const db = useDbStore(); const ui = useUiStore();
  const state = db.state; const notify = ui.notify;

  const categorias = computed(() => [...new Set(state.products.map(p => p.categoria))]);
  const variantIndex = computed(() => { const m = {}; state.products.forEach(p => p.variantes.forEach(v => m[v.sku] = { p, v })); return m; });
  // Leitor de código de barras: o código EAN-13 da etiqueta leva direto à variação.
  const variantPorCodigo = computed(() => { const m = {}; state.products.forEach(p => p.variantes.forEach(v => { if (v.codigoBarras) m[v.codigoBarras] = { p, v }; })); return m; });
  const variantOf = sku => variantIndex.value[sku]?.v || { qtd: 0 };
  const lowStock = computed(() => state.products.flatMap(p => p.variantes.filter(v => v.qtd <= v.min).map(v => ({ ...v, nome: p.nome }))).sort((a, b) => a.qtd - b.qtd));

  const estq = reactive({ busca: '', cat: '', soBaixo: false, exp: null });
  const est = computed(() => { let pecas = 0, custo = 0, venda = 0, skus = 0;
    state.products.forEach(p => p.variantes.forEach(v => { skus++; pecas += v.qtd; custo += v.qtd * p.custo; venda += v.qtd * p.preco; }));
    return { pecas, custo, venda: venda || 1, skus }; });
  const estProdutos = computed(() => { const q = estq.busca.trim().toLowerCase();
    return state.products.filter(p => (!estq.cat || p.categoria === estq.cat) && (!q || p.nome.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.variantes.some(v => v.sku.toLowerCase().includes(q) || (v.codigoBarras || '').includes(q)))
      && (!estq.soBaixo || p.variantes.some(v => v.qtd <= v.min))); });
  const toggleExp = id => { estq.exp = estq.exp === id ? null : id; };
  const vendidas30 = pid => { const lim = isoDate(addDays(startOfToday(), -30)); return state.sales.filter(s => s.data >= lim && vendaValida(s)).reduce((a, s) => a + s.itens.filter(i => i.pid === pid).reduce((b, i) => b + i.qtd, 0), 0); };
  const movsRecentes = computed(() => [...state.movs].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 12));

  /* ---------- entrada de mercadoria (gera conta a pagar no financeiro) ---------- */
  const entrada = reactive({ open: false, pid: '', sku: '', qtd: 10, custo: 0, fornecedor: '', gerarConta: true, venc: '', novaTam: '', novaCor: '' });
  const NOVA_VARIACAO = '__nova__';
  const entradaNova = computed(() => entrada.sku === NOVA_VARIACAO);
  const entradaValida = computed(() => entrada.qtd > 0 && (!entrada.gerarConta || !!entrada.venc) && (!entradaNova.value || (entrada.novaTam.trim() && entrada.novaCor.trim())));
  const entradaProd = computed(() => state.products.find(p => p.id === entrada.pid) || state.products[0]);
  const onEntradaProd = () => { const p = entradaProd.value; const low = p.variantes.slice().sort((a, b) => a.qtd - b.qtd)[0]; entrada.sku = low.sku; entrada.custo = p.custo; };
  const openEntrada = pid => { if (!state.products.length) { notify('Cadastre um produto antes de lançar entrada de mercadoria.'); return; }
    entrada.pid = pid || (lowStock.value[0] ? variantIndex.value[lowStock.value[0].sku].p.id : state.products[0].id);
    onEntradaProd(); Object.assign(entrada, { open: true, qtd: 10, fornecedor: '', gerarConta: true, venc: isoDate(addDays(startOfToday(), 28)), novaTam: '', novaCor: '' }); };
  const salvarEntrada = async () => {
    if (!entradaValida.value) return;
    const nova = entradaNova.value;
    if (!nova && !variantIndex.value[entrada.sku]) return;
    const p = { sku: nova ? null : entrada.sku, qtd: entrada.qtd, custo: round2(entrada.custo || 0), fornecedor: entrada.fornecedor.trim(), gerarConta: entrada.gerarConta, venc: entrada.venc || null,
      produto: nova ? entrada.pid : null, tamanho: nova ? entrada.novaTam.trim() : null, cor: nova ? entrada.novaCor.trim() : null };
    const r = await db.executar(() => api.entradaMercadoria(p));
    if (!r) return;
    entrada.open = false;
    const conta = entrada.gerarConta ? ' e conta a pagar criada' : '';
    if (r.variacaoNova) { estq.exp = entrada.pid; notify(`Variação ${r.tamanho}, ${r.cor} cadastrada com ${entrada.qtd} peças${conta}. Imprima as etiquetas dela.`); }
    else notify(`Entrada de ${entrada.qtd} peças lançada${conta}.`);
  };

  /* ---------- novo produto ---------- */
  const novo = reactive({ open: false, nome: '', categoria: '', custo: null, preco: null, min: DEFAULT_MIN_STOCK, tams: ['P','M','G','GG'], cores: '' });
  const novoCores = computed(() => novo.cores.split(',').map(s => s.trim()).filter(Boolean));
  const novoValido = computed(() => novo.nome.trim() && novo.categoria.trim() && novo.preco > 0 && novo.tams.length && novoCores.value.length);
  const openNovo = () => Object.assign(novo, { open: true, nome: '', categoria: '', custo: null, preco: null, min: DEFAULT_MIN_STOCK, tams: ['P','M','G','GG'], cores: '' });
  const salvarNovo = async () => {
    if (!novoValido.value) return;
    const p = { nome: novo.nome.trim(), categoria: novo.categoria.trim(), preco: novo.preco, custo: novo.custo || 0, minimo: novo.min || 0, tamanhos: [...novo.tams], cores: novoCores.value };
    const r = await db.executar(() => api.novoProduto(p));
    if (!r) return;
    novo.open = false; estq.exp = r.id;
    notify(`Produto ${r.id} cadastrado com ${r.codigos} códigos de barras. Lance a entrada de mercadoria e imprima as etiquetas.`);
  };

  /* ---------- editar produto (vendas já feitas continuam com o preço da época) ---------- */
  const edicao = reactive({ open: false, codigo: '', nome: '', categoria: '', custo: null, preco: null, min: null, minUnico: true, precoAntes: 0, custoAntes: 0 });
  const edicaoValida = computed(() => edicao.nome.trim() && edicao.categoria.trim() && edicao.preco > 0 && (edicao.custo || 0) >= 0
    && (edicao.min === null || edicao.min === '' || edicao.min >= 0));
  const openEdicao = codigo => {
    const p = state.products.find(x => x.id === codigo); if (!p) return;
    const mins = [...new Set(p.variantes.map(v => v.min))];
    Object.assign(edicao, { open: true, codigo: p.id, nome: p.nome, categoria: p.categoria, custo: p.custo, preco: p.preco,
      min: mins.length === 1 ? mins[0] : null, minUnico: mins.length === 1, precoAntes: p.preco, custoAntes: p.custo });
  };
  const salvarEdicao = async () => {
    if (!edicaoValida.value) return;
    const minimo = edicao.min === null || edicao.min === '' ? null : Number(edicao.min);
    const p = { nome: edicao.nome.trim(), categoria: edicao.categoria.trim(), preco: round2(edicao.preco), custo: round2(edicao.custo || 0), minimo };
    if (!await db.executar(() => api.editarProduto(edicao.codigo, p))) return;
    edicao.open = false;
    notify(p.preco !== edicao.precoAntes ? `Preço de ${p.nome} agora é ${brl(p.preco)}.` : `Produto ${p.nome} atualizado.`);
  };

  return { edicao, edicaoValida, openEdicao, salvarEdicao, categorias, variantIndex, variantPorCodigo, variantOf, lowStock, estq, est, estProdutos, toggleExp, vendidas30, movsRecentes,
    entrada, entradaProd, entradaNova, entradaValida, NOVA_VARIACAO, onEntradaProd, openEntrada, salvarEntrada, novo, novoCores, novoValido, openNovo, salvarNovo };
});
