import { describe, it, expect } from 'vitest';
import { montarRelatorioFinanceiro } from '@/domain/relatorios';

const db = {
  sales: [{ id: 10, pagamento: 'pix' }, { id: 11, pagamento: 'credito' }, { id: 12, pagamento: 'crediario' }],
  crediarios: [{ id: 'CR1', parcelas: [{ n: 1, forma: 'dinheiro' }] }],
  lanc: [
    { id: 1, tipo: 'receita', categoria: 'Vendas na loja', descricao: 'antes do período', valor: 500, data: '2026-09-28', venc: '2026-09-28', status: 'pago', pagoEm: '2026-09-28', vendaId: 10 },
    { id: 2, tipo: 'receita', categoria: 'Vendas na loja', descricao: 'pix', valor: 200, data: '2026-10-03', venc: '2026-10-03', status: 'pago', pagoEm: '2026-10-03', vendaId: 10 },
    { id: 3, tipo: 'receita', categoria: 'Cartão de crédito a receber', descricao: 'crédito vendido em set', valor: 90, data: '2026-09-20', venc: '2026-10-20', status: 'pago', pagoEm: '2026-10-20', vendaId: 11 },
    { id: 4, tipo: 'receita', categoria: 'Crediário a receber', descricao: 'parcela', valor: 60, data: '2026-09-15', venc: '2026-10-15', status: 'pago', pagoEm: '2026-10-15', credId: 'CR1', parcela: 1 },
    { id: 5, tipo: 'despesa', categoria: 'Ocupação', descricao: 'aluguel', valor: 150, data: '2026-10-10', venc: '2026-10-10', status: 'pago', pagoEm: '2026-10-10' },
    { id: 6, tipo: 'despesa', categoria: 'Pessoal', descricao: 'salário a pagar', valor: 300, data: '2026-10-30', venc: '2026-10-30', status: 'pendente', pagoEm: null },
  ],
};
const outubro = { inicio: '2026-10-01', fim: '2026-10-31' };

describe('relatório no regime de caixa', () => {
  const r = montarRelatorioFinanceiro(db, { ...outubro, regime: 'caixa' });

  it('considera só o que foi pago ou recebido dentro do período', () => {
    expect(r.totais).toMatchObject({ entradas: 350, saidas: 150, resultado: 200, qtdLancamentos: 4 });
  });

  it('parte do saldo acumulado antes do período e calcula o saldo linha a linha', () => {
    expect(r.totais.saldoInicial).toBe(500);
    expect(r.totais.saldoFinal).toBe(700);
    expect(r.linhas.map(l => l.saldo)).toEqual([700, 550, 610, 700]);
  });

  it('separa as entradas por forma de pagamento, incluindo a forma da parcela do crediário', () => {
    expect(r.entradasPorForma.map(f => f.nome)).toEqual(['Pix', 'Crédito', 'Crediário (Dinheiro)']);
  });

  it('lista as contas em aberto que vencem no período', () => {
    expect(r.abertos.map(a => a.id)).toEqual([6]);
    expect(r.totalAbertos.pagar).toBe(300);
  });
});

describe('relatório no regime de competência', () => {
  const r = montarRelatorioFinanceiro(db, { ...outubro, regime: 'competencia', incluirAbertos: false });

  it('usa a data da venda ou despesa, inclusive o que ainda não foi pago', () => {
    expect(r.linhas.map(l => l.id)).toEqual([2, 5, 6]);
    expect(r.totais).toMatchObject({ entradas: 200, saidas: 450, saldoInicial: null, saldoFinal: null });
    expect(r.abertos).toEqual([]);
  });
});

describe('agrupamento por dia', () => {
  const vendas = {
    sales: [{ id: 1, pagamento: 'pix' }, { id: 2, pagamento: 'pix' }, { id: 3, pagamento: 'debito' }],
    crediarios: [],
    lanc: [1, 2, 3].map(id => ({ id, tipo: 'receita', categoria: 'Vendas na loja', descricao: `Venda #${id}`, valor: 100, data: '2026-10-02', venc: '2026-10-02', status: 'pago', pagoEm: '2026-10-02', vendaId: id }))
      .concat([{ id: 4, tipo: 'despesa', categoria: 'Taxas de cartão', descricao: 'Taxa', valor: 1.39, data: '2026-10-02', venc: '2026-10-02', status: 'pago', pagoEm: '2026-10-02', vendaId: 3 }]),
  };

  it('junta as vendas do dia por forma de pagamento sem mudar os totais', () => {
    const r = montarRelatorioFinanceiro(vendas, { ...outubro, regime: 'caixa' });
    expect(r.linhas.map(l => [l.descricao, l.entrada || -l.saida])).toEqual([['Vendas do dia, Pix (2 vendas)', 200], ['Venda #3', 100], ['Taxa', -1.39]]);
    expect(r.totais).toMatchObject({ entradas: 300, saidas: 1.39, qtdLancamentos: 4 });
  });

  it('mostra cada lançamento quando o agrupamento está desligado', () => {
    expect(montarRelatorioFinanceiro(vendas, { ...outubro, regime: 'caixa', agruparPorDia: false }).linhas).toHaveLength(4);
  });
});
