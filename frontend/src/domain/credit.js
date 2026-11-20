/* Crediário próprio: carnê, parcelas e situação de crédito do cliente. */
import { PAY_LABEL } from './constants';
import { round2, addMonthsIso } from './utils';

export const DEFAULT_CRED = { maxParcelas: 6, limitePadrao: 1500, multa: 2, jurosMes: 1, primeiroVencDias: 30 };
export function planoParcelas(financiado, n, primeiroVenc){
  const base = round2(financiado / n);
  return Array.from({ length: n }, (_, i) => ({ n: i + 1, valor: i === n - 1 ? round2(financiado - base * (n - 1)) : base, venc: addMonthsIso(primeiroVenc, i), pagoEm: null, valorPago: 0, forma: '' }));
}
/* Cria o carnê da venda e os lançamentos a receber de cada parcela (mais a entrada, se houver). */
export function criarCrediario(sale, entrada, entradaForma, primeiroVenc, ids, nomeCliente){
  const day = sale.data.slice(0,10);
  const cred = { id: 'CR' + ids(), vendaId: sale.id, clienteId: sale.clienteId, data: day, total: sale.total, entrada, entradaForma, parcelas: planoParcelas(round2(sale.total - entrada), sale.parcelas, primeiroVenc) };
  const lancs = [];
  if (entrada > 0) lancs.push({ id: ids(), data: day, origem: 'PDV', vendaId: sale.id, tipo: 'receita', categoria: 'Vendas na loja', descricao: `Venda #${sale.id}, entrada do crediário (${PAY_LABEL[entradaForma]})`, valor: entrada, venc: day, status: 'pago', pagoEm: day });
  cred.parcelas.forEach(p => lancs.push({ id: ids(), data: day, origem: 'Crediário', vendaId: sale.id, credId: cred.id, parcela: p.n, tipo: 'receita', categoria: 'Crediário a receber',
    descricao: `Crediário ${nomeCliente}, venda #${sale.id}, parcela ${p.n}/${sale.parcelas}`, valor: p.valor, venc: p.venc, status: 'pendente', pagoEm: null }));
  return { cred, lancs };
}

export const parcelaAberta = p => !p.pagoEm && !p.canceladaEm;
export const limiteDe = (db, c) => c.limite == null ? db.credCfg.limitePadrao : c.limite;
/* Quanto o cliente deve, quanto ainda pode parcelar e desde quando está em atraso. */
export function credStatus(db, c, todayIso){
  const crs = db.crediarios.filter(cr => cr.clienteId === c.id); let emAberto = 0, atrasoDesde = '';
  crs.forEach(cr => cr.parcelas.forEach(p => { if (parcelaAberta(p)) { emAberto += p.valor; if (p.venc < todayIso && (!atrasoDesde || p.venc < atrasoDesde)) atrasoDesde = p.venc; } }));
  const limite = limiteDe(db, c);
  return { tem: crs.length > 0, emAberto: round2(emAberto), limite, disponivel: round2(Math.max(0, limite - emAberto)), atrasoDesde };
}
