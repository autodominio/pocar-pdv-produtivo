/* Caixa: abertura, sangria, suprimento e fechamento com conferência do dinheiro. */
import { CAT_ESTORNO, PAY_LABEL, VALOR_INICIAL_CAIXA, OPERATOR } from './constants';
import { round2, isoDate, addDays, startOfToday, prng, brl } from './utils';

export const caixaAberto = db => db.caixas.find(c => !c.fechadoEm) || null;

/* Lançamentos já pagos ganham a forma e o caixa em que entraram, para conferir a gaveta. */
export function marcarLancamentos(lancs, caixaId, forma) {
  lancs.forEach(l => { if (l.status === 'pago' && !l.forma) l.forma = forma; if (l.status === 'pago') l.caixaId = caixaId; });
}

export function resumoCaixa(db, caixa) {
  const vendas = db.sales.filter(s => s.caixaId === caixa.id);
  const validas = vendas.filter(s => s.status !== 'cancelada');
  const porForma = {}; validas.forEach(s => { if (s.total > 0) porForma[s.pagamento] = (porForma[s.pagamento] || 0) + s.total; });
  const doCaixa = db.lanc.filter(l => l.caixaId === caixa.id && l.status === 'pago');
  const soma = arr => round2(arr.reduce((t, l) => t + l.valor, 0));
  const dinheiroEntrou = soma(doCaixa.filter(l => l.tipo === 'receita' && l.forma === 'dinheiro'));
  const dinheiroSaiu = soma(doCaixa.filter(l => l.tipo === 'despesa' && l.forma === 'dinheiro'));
  const suprimentos = round2(caixa.movs.filter(m => m.tipo === 'suprimento').reduce((t, m) => t + m.valor, 0));
  const sangrias = round2(caixa.movs.filter(m => m.tipo === 'sangria').reduce((t, m) => t + m.valor, 0));
  return {
    qtdVendas: validas.length, canceladas: vendas.length - validas.length, totalVendas: round2(validas.reduce((t, s) => t + s.total, 0)),
    porForma: Object.entries(porForma).map(([k, v]) => ({ k, label: PAY_LABEL[k], valor: round2(v) })).sort((a, b) => b.valor - a.valor),
    recebCrediario: soma(doCaixa.filter(l => l.tipo === 'receita' && l.credId)),
    estornos: soma(doCaixa.filter(l => l.categoria === CAT_ESTORNO)),
    dinheiroEntrou, dinheiroSaiu, suprimentos, sangrias,
    esperado: round2(caixa.valorInicial + dinheiroEntrou - dinheiroSaiu + suprimentos - sangrias),
  };
}

/* Dados de exemplo: um caixa por dia de venda nos últimos 14 dias; o de hoje fica aberto. */
export function seedCaixas(db, ids) {
  const r = prng(777); const hoje = isoDate(startOfToday()); const desde = isoDate(addDays(startOfToday(), -13));
  const dias = [...new Set(db.sales.map(s => s.data.slice(0, 10)).filter(d => d >= desde))].sort();
  if (!dias.includes(hoje)) dias.push(hoje); // a demonstração já começa com o caixa de hoje aberto
  const auditoria = [];
  db.caixas = dias.map(dia => {
    const cx = { id: 'CX' + ids(), abertoEm: `${dia}T08:55`, abertoPor: OPERATOR, valorInicial: VALOR_INICIAL_CAIXA, movs: [], fechadoEm: null };
    db.sales.filter(s => s.data.startsWith(dia)).forEach(s => {
      s.caixaId = cx.id;
      const lancs = db.lanc.filter(l => l.vendaId === s.id && l.data === dia);
      marcarLancamentos(lancs.filter(l => !/entrada do crediário/.test(l.descricao)), cx.id, s.pagamento);
      marcarLancamentos(lancs.filter(l => /entrada do crediário/.test(l.descricao)), cx.id, s.entradaForma);
    });
    auditoria.push({ id: ids(), quando: cx.abertoEm, usuario: OPERATOR, acao: 'Caixa aberto', detalhe: `Troco inicial de ${brl(VALOR_INICIAL_CAIXA)}` });
    if (dia < hoje) {
      const res = resumoCaixa(db, cx);
      if (res.dinheiroEntrou > 600 && r() < 0.5) { const valor = Math.floor(res.dinheiroEntrou / 200) * 100;
        cx.movs.push({ id: ids(), quando: `${dia}T15:30`, tipo: 'sangria', valor, motivo: 'Depósito no banco', usuario: OPERATOR }); }
      const esperado = resumoCaixa(db, cx).esperado; const x = r();
      const contado = round2(esperado + (x < 0.7 ? 0 : x < 0.85 ? -Math.ceil(r() * 15) : Math.ceil(r() * 5)));
      Object.assign(cx, { fechadoEm: `${dia}T19:10`, fechadoPor: OPERATOR, esperado, contado, diferenca: round2(contado - esperado), obs: '' });
      auditoria.push({ id: ids(), quando: cx.fechadoEm, usuario: OPERATOR, acao: 'Caixa fechado', detalhe: `Esperado ${brl(esperado)}, contado ${brl(contado)}` });
    }
    return cx;
  });
  return auditoria;
}
