import { describe, it, expect } from 'vitest';
import { financeEntriesFor, calcResultado } from '@/domain/finance';

const ids = (() => { let n = 1; return () => n++; })();
const venda = over => ({ id: 1, data: '2026-11-05T10:00', total: 100, pagamento: 'pix', parcelas: 1, ...over });

describe('financeEntriesFor', () => {
  it('lança a venda no Pix como receita já recebida, sem taxa', () => {
    const out = financeEntriesFor(venda(), ids, '2026-11-05');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ tipo: 'receita', valor: 100, status: 'pago', pagoEm: '2026-11-05' });
  });

  it('divide o crédito parcelado em recebíveis D+30 e ajusta o centavo na última parcela', () => {
    const out = financeEntriesFor(venda({ total: 100, pagamento: 'credito', parcelas: 3 }), ids, '2026-11-05');
    const parcelas = out.filter(l => l.tipo === 'receita');
    expect(parcelas.map(p => p.valor)).toEqual([33.33, 33.33, 33.34]);
    expect(parcelas.map(p => p.venc)).toEqual(['2026-12-05', '2027-01-04', '2027-02-03']);
    expect(parcelas.every(p => p.status === 'pendente')).toBe(true);
    expect(out.find(l => l.categoria === 'Taxas de cartão').valor).toBe(3.49);
  });

  it('não gera lançamentos para crediário (o carnê cria os seus) nem para venda paga só com vale/cashback', () => {
    expect(financeEntriesFor(venda({ pagamento: 'crediario', parcelas: 3 }), ids, '2026-11-05')).toEqual([]);
    expect(financeEntriesFor(venda({ total: 0 }), ids, '2026-11-05')).toEqual([]);
  });
});

describe('calcResultado', () => {
  it('desconta vales e cashback da receita e soma juros do crediário no lucro', () => {
    const db = {
      sales: [{ data: '2026-10-10T10:00', subtotal: 1000, desconto: 50, valeUsado: 100, cashbackUsado: 20, total: 830, itens: [{ custo: 300, qtd: 1 }] }],
      lanc: [
        { tipo: 'despesa', categoria: 'Taxas de cartão', valor: 10, data: '2026-10-10' },
        { tipo: 'despesa', categoria: 'Fornecedores', valor: 999, data: '2026-10-10' },
        { tipo: 'despesa', categoria: 'Ocupação', valor: 200, data: '2026-10-10' },
        { tipo: 'receita', categoria: 'Juros e multa (crediário)', valor: 5, data: '2026-10-12' },
      ],
    };
    const r = calcResultado(db, '2026-10');
    expect(r.liquida).toBe(830);
    expect(r.lucroBruto).toBe(520);            // 830 - 300 custo - 10 taxa
    expect(r.totalDespesas).toBe(200);          // fornecedor vira custo só quando a peça é vendida
    expect(r.resultado).toBe(325);              // 520 - 200 + 5 de juros
  });
});

describe('lucro por período e semanas', () => {
  it('divide o período em semanas de segunda a domingo, cortando as pontas', async () => {
    const { semanasDoPeriodo } = await import('../src/domain/finance');
    // 2026-11-04 é quarta; 2026-11-18 é quarta
    expect(semanasDoPeriodo('2026-11-04', '2026-11-18')).toEqual([
      { ini: '2026-11-04', fim: '2026-11-08' },
      { ini: '2026-11-09', fim: '2026-11-15' },
      { ini: '2026-11-16', fim: '2026-11-18' },
    ]);
    expect(semanasDoPeriodo('2026-11-15', '2026-11-15')).toEqual([{ ini: '2026-11-15', fim: '2026-11-15' }]);
    expect(semanasDoPeriodo('2026-11-20', '2026-11-10')).toEqual([]);
  });

  it('a soma das semanas dá o resultado do período inteiro', async () => {
    const { calcResultadoPeriodo, calcResultado, semanasDoPeriodo } = await import('../src/domain/finance');
    const { buildSeed } = await import('../src/domain/seed');
    const db = buildSeed();
    const mes = db.sales[db.sales.length - 1].data.slice(0, 7);
    const ini = mes + '-01'; const fim = mes + '-31';
    const total = calcResultadoPeriodo(db, ini, fim);
    expect(total.resultado).toBeCloseTo(calcResultado(db, mes).resultado, 6);
    const somaSemanas = semanasDoPeriodo(ini, mes + '-28').concat(semanasDoPeriodo(mes + '-29', fim))
      .reduce((t, w) => t + calcResultadoPeriodo(db, w.ini, w.fim).resultado, 0);
    expect(somaSemanas).toBeCloseTo(total.resultado, 6);
  });
});
