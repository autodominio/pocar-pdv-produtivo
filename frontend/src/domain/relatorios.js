/* Relatório financeiro de entradas e saídas. Função pura: recebe os dados e devolve tudo já somado.
   Na versão com backend, esta mesma lógica vai para o RelatorioFinanceiroService (Spring Boot). */
import { PAY_LABEL } from './constants';
import { round2 } from './utils';

export const REGIMES = {
  caixa: { label: 'Regime de caixa', ajuda: 'Considera a data em que o dinheiro entrou ou saiu. Só entra o que já foi pago ou recebido.' },
  competencia: { label: 'Regime de competência', ajuda: 'Considera a data da venda ou da despesa, mesmo que o pagamento seja em outro mês.' },
};

/* Data que vale para o período em cada regime. */
const dataNoRegime = (l, regime) => regime === 'caixa' ? l.pagoEm : l.data;

/* Forma de pagamento de uma entrada, para o resumo por forma. */
function formaDe(l, vendasPorId, crediarios) {
  if (l.credId && l.parcela) {
    const cr = crediarios.find(c => c.id === l.credId); const p = cr && cr.parcelas.find(x => x.n === l.parcela);
    return p && p.forma ? `Crediário (${PAY_LABEL[p.forma]})` : 'Crediário';
  }
  if (l.categoria === 'Juros e multa (crediário)') return 'Crediário (juros e multa)';
  const venda = l.vendaId ? vendasPorId[l.vendaId] : null;
  if (venda) return venda.pagamento === 'crediario' ? 'Crediário (entrada)' : PAY_LABEL[venda.pagamento];
  return 'Outras entradas';
}

const agrupar = (itens, chave) => {
  const m = {}; itens.forEach(l => { const k = chave(l); m[k] = (m[k] || 0) + l.valor; });
  const total = itens.reduce((t, l) => t + l.valor, 0);
  return Object.entries(m).map(([nome, valor]) => ({ nome, valor: round2(valor), share: total ? valor / total : 0 })).sort((a, b) => b.valor - a.valor);
};

/* Categorias com muitos lançamentos pequenos por dia, que o relatório pode juntar numa linha. */
const AGRUPAVEIS = {
  'Vendas na loja': (forma, n) => `Vendas do dia, ${forma} (${n} vendas)`,
  'Taxas de cartão': (forma, n) => `Taxas de cartão do dia (${n} vendas)`,
  'Cartão de crédito a receber': (forma, n) => `Recebimentos de cartão de crédito (${n} parcelas)`,
};
const situacaoDe = l => l.status === 'pago' ? (l.tipo === 'receita' ? 'Recebido' : 'Pago') : 'Pendente';
const itemUnico = ({ l, data }) => ({ id: l.id, data, tipo: l.tipo, descricao: l.descricao, categoria: l.categoria, origem: l.origem, situacao: situacaoDe(l), valor: l.valor, qtd: 1 });

function agruparLancamentos(itens) {
  const grupos = new Map();
  itens.forEach(x => {
    const rotulo = AGRUPAVEIS[x.l.categoria];
    if (!rotulo) { grupos.set('id' + x.l.id, { ...itemUnico(x) }); return; }
    const chave = [x.data, x.l.tipo, x.l.categoria, x.forma, x.l.status].join('|');
    const g = grupos.get(chave);
    if (!g) { grupos.set(chave, { ...itemUnico(x), rotulo, forma: x.forma }); return; }
    g.valor += x.l.valor; g.qtd++; g.id = Math.min(g.id, x.l.id);
  });
  return [...grupos.values()].map(g => {
    const { rotulo, forma, ...item } = g;
    return g.qtd > 1 ? { ...item, valor: round2(item.valor), descricao: rotulo(forma, g.qtd), origem: 'PDV' } : item;
  });
}

function montarLinhas(itens, saldoInicial) {
  let saldo = saldoInicial;
  return itens
    .sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === b.tipo ? a.id - b.id : a.tipo === 'receita' ? -1 : 1))
    .map(i => { saldo += i.tipo === 'receita' ? i.valor : -i.valor;
      return { id: i.id, data: i.data, descricao: i.descricao, categoria: i.categoria, origem: i.origem, situacao: i.situacao, qtd: i.qtd,
        entrada: i.tipo === 'receita' ? i.valor : 0, saida: i.tipo === 'despesa' ? i.valor : 0, saldo: round2(saldo) }; });
}

/**
 * @param db        dados da loja (lanc, sales, crediarios)
 * @param inicio    'AAAA-MM-DD' (inclusivo)
 * @param fim       'AAAA-MM-DD' (inclusivo)
 * @param regime    'caixa' | 'competencia'
 * @param incluirAbertos  lista as contas a pagar e a receber que vencem no período
 * @param agruparPorDia   junta vendas, taxas e recebíveis de cartão do mesmo dia numa linha só
 */
export function montarRelatorioFinanceiro(db, { inicio, fim, regime = 'caixa', incluirAbertos = true, agruparPorDia = true }) {
  const noPeriodo = d => !!d && d.slice(0, 10) >= inicio && d.slice(0, 10) <= fim;
  const considerados = db.lanc.filter(l => (regime === 'caixa' ? l.status === 'pago' : l.status !== 'cancelado') && noPeriodo(dataNoRegime(l, regime)));
  const entradas = considerados.filter(l => l.tipo === 'receita');
  const saidas = considerados.filter(l => l.tipo === 'despesa');
  const totalEntradas = round2(entradas.reduce((t, l) => t + l.valor, 0));
  const totalSaidas = round2(saidas.reduce((t, l) => t + l.valor, 0));

  // Saldo inicial só faz sentido no caixa: tudo que foi pago/recebido antes do período.
  const saldoInicial = regime === 'caixa'
    ? round2(db.lanc.filter(l => l.status === 'pago' && l.pagoEm && l.pagoEm < inicio).reduce((t, l) => t + (l.tipo === 'receita' ? l.valor : -l.valor), 0))
    : null;

  const vendasPorId = {}; db.sales.forEach(s => { vendasPorId[s.id] = s; });
  const comForma = considerados.map(l => ({ l, data: dataNoRegime(l, regime).slice(0, 10), forma: l.tipo === 'receita' ? formaDe(l, vendasPorId, db.crediarios || []) : '' }));
  const linhas = montarLinhas(agruparPorDia ? agruparLancamentos(comForma) : comForma.map(x => itemUnico(x)), saldoInicial || 0);
  const abertos = incluirAbertos
    ? db.lanc.filter(l => l.status === 'pendente' && noPeriodo(l.venc)).sort((a, b) => a.venc.localeCompare(b.venc))
      .map(l => ({ id: l.id, venc: l.venc, descricao: l.descricao, categoria: l.categoria, tipo: l.tipo, valor: l.valor }))
    : [];

  return {
    inicio, fim, regime, regimeLabel: REGIMES[regime].label,
    totais: { entradas: totalEntradas, saidas: totalSaidas, resultado: round2(totalEntradas - totalSaidas), saldoInicial,
      saldoFinal: saldoInicial === null ? null : round2(saldoInicial + totalEntradas - totalSaidas), qtdLancamentos: considerados.length },
    entradasPorCategoria: agrupar(entradas, l => l.categoria),
    saidasPorCategoria: agrupar(saidas, l => l.categoria),
    entradasPorForma: agrupar(entradas, l => formaDe(l, vendasPorId, db.crediarios || [])),
    linhas,
    abertos,
    totalAbertos: { receber: round2(abertos.filter(a => a.tipo === 'receita').reduce((t, a) => t + a.valor, 0)), pagar: round2(abertos.filter(a => a.tipo === 'despesa').reduce((t, a) => t + a.valor, 0)) },
  };
}
