import { describe, it, expect } from 'vitest';
import { planoParcelas, criarCrediario, credStatus } from '@/domain/credit';

describe('planoParcelas', () => {
  it('fecha a soma exata no valor financiado', () => {
    const p = planoParcelas(100, 3, '2026-12-05');
    expect(p.map(x => x.valor)).toEqual([33.33, 33.33, 33.34]);
  });

  it('vence todo mês no mesmo dia e usa o último dia quando o mês é mais curto', () => {
    expect(planoParcelas(90, 3, '2027-01-31').map(x => x.venc)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
  });
});

describe('criarCrediario', () => {
  it('lança a entrada como recebida e cada parcela como conta a receber', () => {
    let n = 1; const ids = () => n++;
    const { cred, lancs } = criarCrediario({ id: 7, clienteId: 'C01', data: '2026-11-05T10:00', total: 300, parcelas: 2 }, 100, 'pix', '2026-12-05', ids, 'Ana Ribeiro');
    expect(cred.parcelas.map(p => p.valor)).toEqual([100, 100]);
    expect(lancs[0]).toMatchObject({ valor: 100, status: 'pago' });
    expect(lancs.slice(1).every(l => l.status === 'pendente' && l.credId === cred.id)).toBe(true);
  });
});

describe('credStatus', () => {
  const db = { credCfg: { limitePadrao: 1500 }, crediarios: [{ clienteId: 'C01', parcelas: [
    { valor: 100, venc: '2026-10-01', pagoEm: '2026-10-01' }, { valor: 100, venc: '2026-11-01', pagoEm: null }, { valor: 100, venc: '2026-12-01', pagoEm: null }] }] };

  it('soma o que está em aberto, respeita o limite e aponta o atraso mais antigo', () => {
    expect(credStatus(db, { id: 'C01', limite: 250 }, '2026-11-05')).toMatchObject({ emAberto: 200, disponivel: 50, atrasoDesde: '2026-11-01' });
  });

  it('usa o limite padrão quando o cliente não tem limite próprio', () => {
    expect(credStatus(db, { id: 'C01', limite: null }, '2026-10-15').limite).toBe(1500);
  });
});
