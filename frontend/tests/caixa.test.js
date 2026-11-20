import { describe, it, expect } from 'vitest';
import { resumoCaixa, marcarLancamentos } from '@/domain/caixa';

describe('resumo do caixa', () => {
  it('calcula o dinheiro esperado na gaveta: troco + entradas em dinheiro - estornos + suprimentos - sangrias', () => {
    const caixa = { id: 'CX1', valorInicial: 200, movs: [{ tipo: 'sangria', valor: 300 }, { tipo: 'suprimento', valor: 50 }] };
    const lanc = [
      { tipo: 'receita', valor: 400, status: 'pago' }, { tipo: 'receita', valor: 120, status: 'pago' },
      { tipo: 'receita', valor: 999, status: 'pendente' },
      { tipo: 'despesa', categoria: 'Estornos a clientes', valor: 30, status: 'pago' },
    ];
    marcarLancamentos(lanc.slice(0, 1), 'CX1', 'dinheiro');
    marcarLancamentos(lanc.slice(1, 3), 'CX1', 'pix');
    marcarLancamentos(lanc.slice(3), 'CX1', 'dinheiro');
    const db = { lanc, sales: [{ caixaId: 'CX1', total: 400, pagamento: 'dinheiro' }, { caixaId: 'CX1', total: 120, pagamento: 'pix' }, { caixaId: 'CX1', total: 80, pagamento: 'pix', status: 'cancelada' }] };
    const r = resumoCaixa(db, caixa);
    expect(r.esperado).toBe(320);            // 200 + 400 - 30 + 50 - 300
    expect(r).toMatchObject({ qtdVendas: 2, canceladas: 1, totalVendas: 520, estornos: 30 });
    expect(lanc[2].caixaId).toBeUndefined(); // pendente não entra no caixa
  });
});
