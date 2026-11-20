import { describe, it, expect } from 'vitest';
import { DEFAULT_FID, aplicarFidelidade, beneficiosDe, cicloDe } from '@/domain/loyalty';

const novoDb = () => ({ vales: [], cashbacks: [], ciclos: {}, fid: { ...DEFAULT_FID } });
const idsFrom = () => { let n = 1; return () => n++; };
const venda = (id, data, total, extra = {}) => ({ id, clienteId: 'C01', data: data + 'T10:00', total, ...extra });

describe('vale-compras', () => {
  it('emite o vale ao passar de R$ 1.000 e leva o excedente para o próximo ciclo', () => {
    const db = novoDb(); const ids = idsFrom();
    aplicarFidelidade(db, venda(1, '2026-10-01', 600), ids);
    const g = aplicarFidelidade(db, venda(2, '2026-10-10', 550), ids);
    expect(g.vale).toMatchObject({ valor: 100, validade: '2026-12-09' });
    expect(cicloDe(db, 'C01', '2026-10-10').acumulado).toBe(150);
  });

  it('zera o acumulado quando o prazo de 90 dias passa', () => {
    const db = novoDb(); const ids = idsFrom();
    aplicarFidelidade(db, venda(1, '2026-01-01', 900), ids);
    expect(cicloDe(db, 'C01', '2026-05-01').acumulado).toBe(0);
  });
});

describe('cashback', () => {
  it('credita 10% do valor pago e só pode ser usado a partir da próxima compra', () => {
    const db = novoDb(); const ids = idsFrom();
    const g = aplicarFidelidade(db, venda(1, '2026-11-01', 200), ids);
    expect(g.cashback).toBe(20);
    expect(beneficiosDe(db, 'C01', '2026-11-01').cashSaldo).toBe(20);
  });

  it('consome o cashback usado, começando pelo que vence primeiro', () => {
    const db = novoDb(); const ids = idsFrom();
    aplicarFidelidade(db, venda(1, '2026-11-01', 100), ids);   // +10, vence 01/12
    aplicarFidelidade(db, venda(2, '2026-11-03', 100), ids);   // +10, vence 03/12
    aplicarFidelidade(db, venda(3, '2026-11-04', 85, { cashbackUsado: 15 }), ids);
    expect(db.cashbacks.map(c => c.saldo)).toEqual([0, 5, 8.5]);
  });

  it('não gera benefício em venda sem cliente', () => {
    const db = novoDb();
    expect(aplicarFidelidade(db, { id: 1, clienteId: null, data: '2026-11-01T10:00', total: 500 }, idsFrom())).toMatchObject({ cashback: 0, vale: null });
  });
});
