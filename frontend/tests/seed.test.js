import { describe, it, expect } from 'vitest';
import { buildSeed } from '@/domain/seed';
import { caixaAberto, resumoCaixa } from '@/domain/caixa';

describe('dados de demonstração', () => {
  const db = buildSeed();
  it('tem caixa aberto hoje, histórico fechado e auditoria', () => {
    expect(caixaAberto(db)).toBeTruthy();
    expect(db.caixas.filter(c => c.fechadoEm).length).toBeGreaterThan(5);
    expect(db.auditoria.length).toBeGreaterThan(10);
  });
  it('tem um cancelamento e uma devolução de exemplo', () => {
    expect(db.sales.filter(s => s.status === 'cancelada')).toHaveLength(1);
    expect(db.sales.filter(s => (s.devolucoes || []).length)).toHaveLength(1);
  });
  it('fecha os caixas antigos com o dinheiro esperado coerente', () => {
    db.caixas.filter(c => c.fechadoEm).forEach(c => expect(c.esperado).toBeGreaterThanOrEqual(0));
    expect(resumoCaixa(db, caixaAberto(db)).esperado).toBeGreaterThanOrEqual(200);
  });
});
