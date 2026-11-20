import { describe, it, expect, beforeEach } from 'vitest';
import { previaDevolucao, registrarDevolucao, cancelarVenda, previaCancelamento } from '@/domain/devolucoes';
import { calcResultado } from '@/domain/finance';
import { faturamento } from '@/domain/sales';
import { DEFAULT_FID } from '@/domain/loyalty';

let db, ctx;
const item = (sku, preco, qtd) => ({ sku, nome: 'Camiseta', tam: 'M', cor: 'Preto', preco, custo: preco / 2, qtd });
beforeEach(() => {
  let n = 100;
  ctx = { ids: () => n++, usuario: 'Leonardo', agora: '2026-11-05T15:00', hoje: '2026-11-05', caixaId: 'CX1' };
  db = {
    products: [{ variantes: [{ sku: 'A', qtd: 5 }, { sku: 'B', qtd: 5 }] }], movs: [], vales: [], cashbacks: [], ciclos: {}, crediarios: [], fid: { ...DEFAULT_FID },
    sales: [{ id: 1, data: '2026-11-03T10:00', itens: [item('A', 100, 2), item('B', 50, 1)], subtotal: 250, desconto: 25, valeUsado: 0, cashbackUsado: 0, total: 225, pagamento: 'pix', clienteId: 'C1' }],
    lanc: [{ id: 1, vendaId: 1, tipo: 'receita', categoria: 'Vendas na loja', valor: 225, data: '2026-11-03', venc: '2026-11-03', status: 'pago', pagoEm: '2026-11-03' }],
  };
  db.cashbacks.push({ id: 9, clienteId: 'C1', valor: 22.5, saldo: 22.5, vendaId: 1, geradoEm: '2026-11-03', validade: '2026-12-03' });
});

describe('devolução', () => {
  it('devolve o valor que o cliente pagou, com o desconto rateado', () => {
    expect(previaDevolucao(db.sales[0], { A: 1 })).toMatchObject({ valorBruto: 100, valorLiquido: 90, valor: 90, pecas: 1 });
  });

  it('com estorno: volta ao estoque, lança a saída de dinheiro e reduz o cashback gerado', () => {
    registrarDevolucao(db, db.sales[0], { qtds: { A: 1 }, destino: 'estorno', forma: 'dinheiro', motivo: 'Tamanho' }, ctx);
    expect(db.products[0].variantes[0].qtd).toBe(6);
    expect(db.lanc.at(-1)).toMatchObject({ tipo: 'despesa', valor: 90, forma: 'dinheiro', caixaId: 'CX1', status: 'pago' });
    expect(db.cashbacks[0].saldo).toBe(13.5);
    expect(faturamento(db.sales, '2026-11')).toBe(135);
    const r = calcResultado(db, '2026-11');
    expect(r.devolucoes).toBe(90);
    expect(r.cmv).toBe(75);           // 125 vendido - 50 devolvido
  });

  it('em troca: não movimenta dinheiro e mantém o faturamento', () => {
    registrarDevolucao(db, db.sales[0], { qtds: { B: 1 }, destino: 'troca', motivo: 'Cor' }, ctx);
    expect(db.lanc).toHaveLength(1);
    expect(faturamento(db.sales, '2026-11')).toBe(225);
  });

  it('não deixa devolver mais do que foi vendido', () => {
    registrarDevolucao(db, db.sales[0], { qtds: { A: 2 }, destino: 'estorno', forma: 'pix', motivo: 'x' }, ctx);
    expect(previaDevolucao(db.sales[0], { A: 1 }).itens).toHaveLength(0);
  });

  it('no crediário, abate das parcelas em aberto antes de devolver dinheiro', () => {
    const s = db.sales[0]; s.pagamento = 'crediario';
    db.lanc = [{ id: 2, vendaId: 1, credId: 'CR1', parcela: 1, tipo: 'receita', valor: 112.5, venc: '2026-12-03', status: 'pendente' },
               { id: 3, vendaId: 1, credId: 'CR1', parcela: 2, tipo: 'receita', valor: 112.5, venc: '2027-01-03', status: 'pendente' }];
    db.crediarios = [{ id: 'CR1', vendaId: 1, parcelas: [{ n: 1, valor: 112.5, pagoEm: null }, { n: 2, valor: 112.5, pagoEm: null }] }];
    const d = registrarDevolucao(db, s, { qtds: { A: 2 }, destino: 'estorno', forma: 'dinheiro', motivo: 'x' }, ctx);
    expect(d).toMatchObject({ abatido: 180, estornado: 0 });
    expect(db.crediarios[0].parcelas.map(p => [p.valor, !!p.canceladaEm])).toEqual([[45, false], [0, true]]);
  });
});

describe('cancelamento', () => {
  it('estorna o que foi recebido, devolve o estoque, retira o cashback gerado e tira a venda do faturamento', () => {
    expect(previaCancelamento(db, db.sales[0])).toMatchObject({ pecas: 3, jaRecebido: 225, podeCancelar: true });
    cancelarVenda(db, db.sales[0], { forma: 'pix', motivo: 'Desistiu' }, ctx);
    expect(db.products[0].variantes.map(v => v.qtd)).toEqual([7, 6]);
    expect(db.lanc.at(-1)).toMatchObject({ tipo: 'despesa', valor: 225, forma: 'pix' });
    expect(db.cashbacks[0].saldo).toBe(0);
    expect(faturamento(db.sales, '2026-11')).toBe(0);
    expect(calcResultado(db, '2026-11').bruta).toBe(0);
  });

  it('cancela recebíveis do cartão que ainda não foram pagos, sem gerar estorno', () => {
    db.lanc[0] = { ...db.lanc[0], status: 'pendente', pagoEm: null };
    cancelarVenda(db, db.sales[0], { forma: 'cartao', motivo: 'x' }, ctx);
    expect(db.lanc).toHaveLength(1);
    expect(db.lanc[0].status).toBe('cancelado');
  });

  it('devolve ao cliente o vale e o cashback que ele usou', () => {
    db.vales.push({ id: 50, clienteId: 'C1', valor: 100, usadoEm: '2026-11-03', vendaId: 1, validade: '2026-12-31' });
    Object.assign(db.sales[0], { valesIds: [50], cashbackUsado: 10 });
    cancelarVenda(db, db.sales[0], { forma: 'pix', motivo: 'x' }, ctx);
    expect(db.vales[0].usadoEm).toBe(null);
    expect(db.cashbacks.at(-1)).toMatchObject({ clienteId: 'C1', saldo: 10 });
  });

  it('não cancela venda que já teve devolução', () => {
    registrarDevolucao(db, db.sales[0], { qtds: { B: 1 }, destino: 'troca', motivo: 'x' }, ctx);
    expect(() => cancelarVenda(db, db.sales[0], { forma: 'pix', motivo: 'x' }, ctx)).toThrow();
  });
});
