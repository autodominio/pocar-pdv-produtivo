/* Cancelamento de venda e devolução/troca de itens. Funções que alteram os dados recebidos (db), como aplicarFidelidade.
   ctx = { ids, usuario, agora: 'AAAA-MM-DDTHH:MM', hoje: 'AAAA-MM-DD', caixaId } */
import { CAT_ESTORNO, FORMAS_ESTORNO, VALE_TROCA_VALIDADE_DIAS } from './constants';
import { round2, plusDays } from './utils';

const variante = (db, sku) => { for (const p of db.products) { const v = p.variantes.find(x => x.sku === sku); if (v) return v; } return null; };
const voltarEstoque = (db, itens, origem, ctx) => itens.forEach(i => {
  const v = variante(db, i.sku); if (v) v.qtd += i.qtd;
  db.movs.push({ id: ctx.ids(), data: ctx.agora, tipo: 'entrada', sku: i.sku, nome: i.nome, var: `${i.tam}, ${i.cor}`, qtd: i.qtd, origem });
});
const lancEstorno = (sale, valor, forma, descricao, ctx) => ({ id: ctx.ids(), data: ctx.hoje, origem: 'Devolução', vendaId: sale.id, tipo: 'despesa', categoria: CAT_ESTORNO,
  descricao, valor: round2(valor), venc: ctx.hoje, status: 'pago', pagoEm: ctx.hoje, forma, caixaId: ctx.caixaId || null });

/* Quanto de cada real de preço o cliente pagou de fato (descontos, vales, cashback e crédito de troca rateados). */
const fatorPago = s => s.subtotal > 0 ? s.total / s.subtotal : 0;
const fatorDesconto = s => s.subtotal > 0 ? (s.subtotal - s.desconto) / s.subtotal : 0;

export function itensDevolviveis(sale) {
  const dev = {}; (sale.devolucoes || []).forEach(d => d.itens.forEach(i => { dev[i.sku] = (dev[i.sku] || 0) + i.qtd; }));
  return sale.itens.map(i => ({ ...i, devolvido: dev[i.sku] || 0, disponivel: i.qtd - (dev[i.sku] || 0) }));
}

/* Valores de uma devolução antes de confirmar. qtds = { sku: quantidade } */
export function previaDevolucao(sale, qtds) {
  const itens = itensDevolviveis(sale).filter(i => (qtds[i.sku] || 0) > 0).map(i => ({ sku: i.sku, nome: i.nome, tam: i.tam, cor: i.cor, preco: i.preco, custo: i.custo, qtd: Math.min(qtds[i.sku], i.disponivel) })).filter(i => i.qtd > 0);
  const bruto = itens.reduce((t, i) => t + i.preco * i.qtd, 0);
  return { itens, valorBruto: round2(bruto), valorLiquido: round2(bruto * fatorDesconto(sale)), valor: round2(bruto * fatorPago(sale)), pecas: itens.reduce((t, i) => t + i.qtd, 0) };
}

/* Abate um valor de recebíveis ainda em aberto (da última parcela para a primeira). Devolve o que sobrou. */
function abaterPendentes(db, sale, valor, filtro, hoje) {
  let resta = valor;
  db.lanc.filter(l => l.vendaId === sale.id && l.tipo === 'receita' && l.status === 'pendente' && filtro(l)).sort((a, b) => b.venc.localeCompare(a.venc)).forEach(l => {
    if (resta <= 0) return;
    const u = Math.min(l.valor, resta); l.valor = round2(l.valor - u); resta = round2(resta - u);
    if (l.credId) { const cr = db.crediarios.find(c => c.id === l.credId); const p = cr && cr.parcelas.find(x => x.n === l.parcela); if (p) { p.valor = l.valor; if (l.valor <= 0) p.canceladaEm = hoje; } }
    if (l.valor <= 0) l.status = 'cancelado';
  });
  return resta;
}

/**
 * Registra a devolução de itens.
 * destino 'estorno': devolve o dinheiro (forma: dinheiro | pix | cartao). Venda no crediário abate primeiro as parcelas em aberto;
 *                    no cartão de crédito, abate primeiro os recebíveis que a maquininha ainda não pagou.
 * destino 'troca':   não movimenta dinheiro; o valor vira crédito para a nova venda no PDV.
 */
export function registrarDevolucao(db, sale, { qtds, destino, forma, motivo }, ctx) {
  const prev = previaDevolucao(sale, qtds);
  if (!prev.itens.length) throw new Error('Nenhum item selecionado para devolução.');
  voltarEstoque(db, prev.itens, `Devolução da venda #${sale.id}`, ctx);
  const dev = { id: ctx.ids(), data: ctx.agora, itens: prev.itens, valorBruto: prev.valorBruto, valorLiquido: prev.valorLiquido, valor: prev.valor,
    destino, forma: destino === 'estorno' ? forma : null, motivo, usuario: ctx.usuario, caixaId: ctx.caixaId || null, estornado: 0, abatido: 0 };

  if (destino === 'estorno') {
    let resta = prev.valor;
    if (sale.pagamento === 'crediario') resta = abaterPendentes(db, sale, resta, l => !!l.credId, ctx.hoje);
    else if (sale.pagamento === 'credito' && forma === 'cartao') resta = abaterPendentes(db, sale, resta, l => !l.credId, ctx.hoje);
    dev.abatido = round2(prev.valor - resta); dev.estornado = round2(resta);
    if (resta > 0) db.lanc.push(lancEstorno(sale, resta, forma, `Devolução da venda #${sale.id} (${FORMAS_ESTORNO[forma]})`, ctx));
    // O cliente não fica com benefício gerado por um valor que voltou para ele.
    db.cashbacks.filter(c => c.vendaId === sale.id).forEach(c => { c.saldo = round2(Math.max(0, c.saldo - c.valor * prev.valor / (sale.total || 1))); });
    if (sale.clienteId && db.ciclos[sale.clienteId]) db.ciclos[sale.clienteId].acumulado = round2(Math.max(0, db.ciclos[sale.clienteId].acumulado - prev.valor));
  }
  (sale.devolucoes = sale.devolucoes || []).push(dev);
  return dev;
}

/* O que acontece se a venda for cancelada, para mostrar antes de confirmar. */
export function previaCancelamento(db, sale) {
  const receitas = db.lanc.filter(l => l.vendaId === sale.id && l.tipo === 'receita');
  return {
    pecas: sale.itens.reduce((t, i) => t + i.qtd, 0),
    jaRecebido: round2(receitas.filter(l => l.status === 'pago').reduce((t, l) => t + l.valor, 0)),
    pendenteCancelado: round2(receitas.filter(l => l.status === 'pendente').reduce((t, l) => t + l.valor, 0)),
    beneficiosDevolvidos: round2((sale.valeUsado || 0) + (sale.cashbackUsado || 0)),
    podeCancelar: sale.status !== 'cancelada' && !(sale.devolucoes || []).length,
  };
}

/* Cancela a venda inteira: estoque volta, recebíveis em aberto são cancelados, o que já foi recebido é estornado
   e os vales/cashback usados voltam para o cliente; os benefícios que a venda gerou são retirados. */
export function cancelarVenda(db, sale, { forma, motivo }, ctx) {
  const prev = previaCancelamento(db, sale);
  if (!prev.podeCancelar) throw new Error('Esta venda não pode ser cancelada. Se já teve devolução, devolva os itens restantes.');
  voltarEstoque(db, sale.itens, `Cancelamento da venda #${sale.id}`, ctx);
  db.lanc.filter(l => l.vendaId === sale.id && l.tipo === 'receita' && l.status === 'pendente').forEach(l => { l.status = 'cancelado'; });
  db.crediarios.filter(c => c.vendaId === sale.id).forEach(c => c.parcelas.forEach(p => { if (!p.pagoEm) p.canceladaEm = ctx.hoje; }));
  if (prev.jaRecebido > 0) db.lanc.push(lancEstorno(sale, prev.jaRecebido, forma, `Cancelamento da venda #${sale.id} (${FORMAS_ESTORNO[forma]})`, ctx));

  (sale.valesIds || []).forEach(id => { const v = db.vales.find(x => x.id === id); if (v) { v.usadoEm = null; v.vendaId = null; } });
  if (sale.cashbackUsado > 0 && sale.clienteId) db.cashbacks.push({ id: ctx.ids(), clienteId: sale.clienteId, valor: sale.cashbackUsado, saldo: sale.cashbackUsado,
    geradoEm: ctx.hoje, validade: plusDays(ctx.hoje, db.fid.cashValidade), vendaId: null, origem: `Devolvido do cancelamento da venda #${sale.id}` });
  db.cashbacks.filter(c => c.vendaId === sale.id).forEach(c => { c.saldo = 0; c.canceladoEm = ctx.hoje; });
  db.vales.filter(v => v.vendaOrigem === sale.id && !v.usadoEm).forEach(v => { v.canceladoEm = ctx.hoje; });
  if (sale.clienteId && db.ciclos[sale.clienteId]) db.ciclos[sale.clienteId].acumulado = round2(Math.max(0, db.ciclos[sale.clienteId].acumulado - sale.total));

  Object.assign(sale, { status: 'cancelada', canceladaEm: ctx.agora, canceladaPor: ctx.usuario, motivoCancelamento: motivo, estorno: { valor: prev.jaRecebido, forma: prev.jaRecebido > 0 ? forma : null } });
  return prev;
}

/* Sobra de crédito de troca vira vale para o cliente usar depois. */
export function criarValeTroca(db, clienteId, valor, vendaId, ctx) {
  const vale = { id: ctx.ids(), clienteId, valor: round2(valor), emitidoEm: ctx.hoje, validade: plusDays(ctx.hoje, VALE_TROCA_VALIDADE_DIAS), usadoEm: null, vendaOrigem: null, origem: `Sobra da troca na venda #${vendaId}` };
  db.vales.push(vale);
  return vale;
}

export { CAT_ESTORNO };
