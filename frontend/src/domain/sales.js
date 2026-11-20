/* Regras sobre vendas válidas e faturamento líquido (descontando cancelamentos e devoluções com estorno). */
export const vendaValida = s => s.status !== 'cancelada';

/* Faturamento de um período (prefixo 'AAAA-MM' ou 'AAAA-MM-DD'): vendas válidas menos o que foi estornado em devoluções.
   Em troca, o cliente não recebe dinheiro de volta, então a venda original continua contando e a nova conta só a diferença paga. */
export function faturamento(sales, prefixo, filtroVenda = () => true) {
  let total = 0;
  sales.forEach(s => {
    if (!filtroVenda(s)) return;
    if (vendaValida(s) && s.data.startsWith(prefixo)) total += s.total;
    (s.devolucoes || []).forEach(d => { if (d.destino === 'estorno' && d.data.startsWith(prefixo)) total -= d.valor; });
  });
  return Math.round(total * 100) / 100;
}
