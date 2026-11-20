import { CARD_FEES, PAY_LABEL, CREDIT_SETTLEMENT_DAYS, CAT_ESTORNO } from './constants';
import { round2, isoDate, addDays, parseDay } from './utils';

/* Gera os lançamentos financeiros de uma venda: é aqui que PDV e financeiro se integram. */
export function financeEntriesFor(sale, ids, todayIso){
  const day = sale.data.slice(0,10);
  const out = [];
  if (sale.total <= 0 || sale.pagamento === 'crediario') return out; // crediário gera seus lançamentos em criarCrediario // venda paga inteira com vale/cashback não gera receita
  const base = { data: day, origem: 'PDV', vendaId: sale.id, categoria: 'Vendas na loja', tipo: 'receita' };
  if (sale.pagamento === 'credito') {
    const parcela = round2(sale.total / sale.parcelas);
    for (let i = 1; i <= sale.parcelas; i++) {
      const venc = isoDate(addDays(parseDay(day), CREDIT_SETTLEMENT_DAYS * i));
      const valor = i === sale.parcelas ? round2(sale.total - parcela * (sale.parcelas - 1)) : parcela;
      const pago = venc <= todayIso;
      out.push({ ...base, id: ids(), descricao: `Venda #${sale.id}, crédito ${i}/${sale.parcelas}`, categoria: 'Cartão de crédito a receber', valor, venc, status: pago ? 'pago' : 'pendente', pagoEm: pago ? venc : null });
    }
  } else {
    out.push({ ...base, id: ids(), descricao: `Venda #${sale.id} (${PAY_LABEL[sale.pagamento]})`, valor: sale.total, venc: day, status: 'pago', pagoEm: day });
  }
  const fee = round2(sale.total * CARD_FEES[sale.pagamento]);
  if (fee > 0) out.push({ id: ids(), data: day, origem: 'PDV', vendaId: sale.id, tipo: 'despesa', categoria: 'Taxas de cartão', descricao: `Taxa ${PAY_LABEL[sale.pagamento].toLowerCase()} da venda #${sale.id}`, valor: fee, venc: day, status: 'pago', pagoEm: day });
  return out;
}

/* Resultado (lucro) de um mês por competência. Usada no DRE, no lucro mensal e no fechamento. */
/* Resultado (lucro) de um período por competência, de ini a fim ('AAAA-MM-DD', inclusive). */
export function calcResultadoPeriodo(db, ini, fim){
  const noPeriodo = data => { const d = data.slice(0, 10); return d >= ini && d <= fim; };
  const s = db.sales.filter(x => noPeriodo(x.data) && x.status !== 'cancelada');
  // devoluções do período, inclusive de vendas feitas antes dele
  const devs = db.sales.flatMap(x => x.devolucoes || []).filter(d => noPeriodo(d.data));
  const devolucoes = devs.reduce((a, d) => a + d.valorLiquido, 0);
  const cmvDevolvido = devs.reduce((a, d) => a + d.itens.reduce((b, i) => b + i.custo * i.qtd, 0), 0);
  const bruta = s.reduce((a, x) => a + x.subtotal, 0);
  const descontos = s.reduce((a, x) => a + x.desconto, 0);
  const fidelidade = s.reduce((a, x) => a + (x.valeUsado || 0) + (x.cashbackUsado || 0), 0);
  const liquida = bruta - descontos - fidelidade - devolucoes;
  const cmv = s.reduce((a, x) => a + x.itens.reduce((b, i) => b + i.custo * i.qtd, 0), 0) - cmvDevolvido;
  const doPeriodo = db.lanc.filter(l => l.tipo === 'despesa' && noPeriodo(l.data));
  const taxas = doPeriodo.filter(l => l.categoria === 'Taxas de cartão').reduce((a, l) => a + l.valor, 0);
  const lucroBruto = liquida - cmv - taxas;
  const porCat = {}; doPeriodo.filter(l => !['Taxas de cartão', 'Fornecedores', CAT_ESTORNO].includes(l.categoria) && l.status !== 'cancelado').forEach(l => porCat[l.categoria] = (porCat[l.categoria] || 0) + l.valor);
  const despesas = Object.entries(porCat).map(([cat, valor]) => ({ cat, valor: round2(valor) })).sort((a, b) => b.valor - a.valor);
  const totalDespesas = despesas.reduce((a, d) => a + d.valor, 0);
  const encargos = db.lanc.filter(l => l.tipo === 'receita' && l.categoria === 'Juros e multa (crediário)' && noPeriodo(l.data)).reduce((a, l) => a + l.valor, 0);
  const resultado = lucroBruto - totalDespesas + encargos;
  return { vendas: s.length, bruta, descontos, fidelidade, devolucoes, liquida, cmv, taxas, lucroBruto, despesas, totalDespesas, encargos, resultado, margem: liquida > 0 ? resultado / liquida : 0 };
}

/* Resultado do mês 'AAAA-MM'. */
export const calcResultado = (db, m) => calcResultadoPeriodo(db, m + '-01', m + '-31');

/* Semanas de segunda a domingo que cobrem o período; a primeira e a última são cortadas nas datas escolhidas. */
export function semanasDoPeriodo(ini, fim){
  if (!ini || !fim || ini > fim) return [];
  const dia = iso => new Date(iso + 'T00:00:00Z');
  const txt = d => d.toISOString().slice(0, 10);
  const out = [];
  let inicio = dia(ini);
  const ultimo = dia(fim);
  while (inicio <= ultimo) {
    const domingo = new Date(inicio); domingo.setUTCDate(domingo.getUTCDate() + (7 - domingo.getUTCDay()) % 7);
    const fimSemana = domingo < ultimo ? domingo : ultimo;
    out.push({ ini: txt(inicio), fim: txt(fimSemana) });
    inicio = new Date(fimSemana); inicio.setUTCDate(inicio.getUTCDate() + 1);
  }
  return out;
}
