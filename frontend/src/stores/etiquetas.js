/* Gerador de etiquetas: escolha da folha, do que aparece na etiqueta, das peças e quantidades. */
import { defineStore } from 'pinia';
import { reactive, computed } from 'vue';
import { FOLHAS, porFolha, montarEtiquetas, totalFolhas } from '@/domain/etiquetas';
import { gerarEtiquetasPdf } from '@/services/pdf/etiquetasPdf';
import { useDbStore } from './db';
import { useUiStore } from './ui';
import { useAuditStore } from './audit';
import { api } from '@/services/api';

const NOME_LOJA = 'Pocar Sport';
const PADRAO = { folhaId: 'A4351', campos: { nome: true, variacao: true, preco: true, sku: false, codigoBarras: true, loja: false }, ajusteX: 0, ajusteY: 0 };

export const useEtiquetasStore = defineStore('etiquetas', () => {
  const db = useDbStore(); const ui = useUiStore();
  const state = db.state;

  const et = reactive({ open: false, folhaId: PADRAO.folhaId, campos: { ...PADRAO.campos }, ajusteX: 0, ajusteY: 0, inicio: 1, contorno: false, busca: '', qtds: {}, gerando: false });
  const folha = computed(() => FOLHAS.find(f => f.id === et.folhaId) || FOLHAS[0]);
  const capacidade = computed(() => porFolha(folha.value));

  /* Abre com as preferências salvas (a folha e o ajuste fino ficam guardados no servidor).
     pid: já seleciona as peças em estoque desse produto. */
  const openEtiquetas = (pid = null) => {
    const cfg = state.etiquetasCfg || PADRAO;
    const qtds = {};
    if (pid) { const p = state.products.find(x => x.id === pid); if (p) p.variantes.forEach(v => { qtds[v.sku] = Math.max(0, v.qtd); }); }
    Object.assign(et, { open: true, folhaId: cfg.folhaId, campos: { ...PADRAO.campos, ...cfg.campos }, ajusteX: cfg.ajusteX || 0, ajusteY: cfg.ajusteY || 0,
      inicio: 1, contorno: false, busca: '', qtds, gerando: false });
  };

  const produtosFiltrados = computed(() => { const q = et.busca.trim().toLowerCase();
    return state.products.filter(p => !q || p.nome.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.variantes.some(v => (v.codigoBarras || '').includes(q))); });
  const usarEstoque = () => produtosFiltrados.value.forEach(p => p.variantes.forEach(v => { et.qtds[v.sku] = Math.max(0, v.qtd); }));
  const limpar = () => { et.qtds = {}; };
  const etiquetas = computed(() => montarEtiquetas(state.products, et.qtds));
  const folhas = computed(() => totalFolhas(folha.value, etiquetas.value.length, et.inicio));
  const exemplo = computed(() => etiquetas.value[0] || montarEtiquetas(state.products.slice(0, 1), { [state.products[0]?.variantes[0]?.sku]: 1 })[0] || null);

  const erro = computed(() => {
    if (!Number.isInteger(et.inicio) || et.inicio < 1 || et.inicio > capacidade.value) return `A posição inicial vai de 1 a ${capacidade.value}.`;
    if (Math.abs(et.ajusteX) > 5 || Math.abs(et.ajusteY) > 5) return 'O ajuste fino vai de -5 a 5 mm.';
    if (!Object.values(et.campos).some(Boolean)) return 'Escolha pelo menos uma informação para a etiqueta.';
    if (!etiquetas.value.length) return 'Informe a quantidade de etiquetas de pelo menos uma peça.';
    return ''; });

  const gerar = async () => {
    if (erro.value || et.gerando) return;
    et.gerando = true;
    try {
      const r = await gerarEtiquetasPdf({ etiquetas: etiquetas.value, folha: folha.value, campos: et.campos, inicio: et.inicio, ajusteX: et.ajusteX, ajusteY: et.ajusteY, contorno: et.contorno, loja: NOME_LOJA });
      // guarda a folha e o ajuste fino no servidor para a próxima impressão
      const cfg = { folhaId: et.folhaId, campos: { ...et.campos }, ajusteX: et.ajusteX, ajusteY: et.ajusteY };
      db.executar(() => api.configEtiquetas(cfg));
      useAuditStore().registrar('Etiquetas geradas', `${etiquetas.value.length} etiquetas em ${r.paginas} ${r.paginas === 1 ? 'folha' : 'folhas'} ${folha.value.id}`);
      et.open = false; ui.notify(`PDF com ${etiquetas.value.length} etiquetas baixado. Imprima em tamanho real (100%), sem ajustar à página.`);
    } catch (e) {
      console.error('Falha ao gerar etiquetas', e); ui.notify('Não foi possível gerar o PDF das etiquetas. Tente de novo.');
    } finally { et.gerando = false; }
  };

  return { et, folha, capacidade, openEtiquetas, produtosFiltrados, usarEstoque, limpar, etiquetas, folhas, exemplo, erro, gerar };
});
