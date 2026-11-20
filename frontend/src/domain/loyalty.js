/* Programa de fidelidade: vale-compras por valor acumulado e cashback. */
import { round2, plusDays } from './utils';

export const DEFAULT_FID = { valeAtivo: true, valeMeta: 1000, valePrazo: 90, valeValor: 100, valeValidade: 60, cashAtivo: true, cashPct: 10, cashValidade: 30 };
export function beneficiosDe(db, clienteId, dayIso){
  const vales = db.vales.filter(v => v.clienteId === clienteId && !v.usadoEm && !v.canceladoEm && v.validade >= dayIso).sort((a, b) => a.validade.localeCompare(b.validade));
  const cash = db.cashbacks.filter(c => c.clienteId === clienteId && c.saldo > 0.009 && c.validade >= dayIso).sort((a, b) => a.validade.localeCompare(b.validade));
  return { vales, cash, cashSaldo: round2(cash.reduce((t, c) => t + c.saldo, 0)), cashValidade: cash[0] ? cash[0].validade : '' };
}
export function cicloDe(db, clienteId, dayIso){
  const c = db.ciclos[clienteId];
  if (!c || plusDays(c.inicio, db.fid.valePrazo) < dayIso) return { inicio: null, fim: null, acumulado: 0 };
  return { inicio: c.inicio, fim: plusDays(c.inicio, db.fid.valePrazo), acumulado: c.acumulado };
}
/* Consome os benefícios usados na venda e credita os novos. Usada pelo PDV e pela geração dos dados de exemplo. */
export function aplicarFidelidade(db, sale, ids){
  const day = sale.data.slice(0,10); const ganhos = { cashback: 0, cashValidade: '', vale: null };
  (sale.valesIds || []).forEach(id => { const v = db.vales.find(x => x.id === id); if (v) { v.usadoEm = day; v.vendaId = sale.id; } });
  let resta = sale.cashbackUsado || 0;
  if (resta > 0) beneficiosDe(db, sale.clienteId, day).cash.forEach(c => { const u = Math.min(c.saldo, resta); c.saldo = round2(c.saldo - u); resta = round2(resta - u); });
  if (!sale.clienteId || sale.total <= 0) return ganhos;
  const f = db.fid;
  if (f.valeAtivo) {
    const atual = cicloDe(db, sale.clienteId, day);
    let acumulado = atual.acumulado + sale.total; let inicio = atual.inicio || day;
    if (acumulado >= f.valeMeta) {
      ganhos.vale = { id: ids(), clienteId: sale.clienteId, valor: f.valeValor, emitidoEm: day, validade: plusDays(day, f.valeValidade), usadoEm: null, vendaOrigem: sale.id };
      db.vales.push(ganhos.vale);
      acumulado -= f.valeMeta; inicio = day; // o que passou da meta já conta para o próximo vale
    }
    db.ciclos[sale.clienteId] = { inicio, acumulado: round2(acumulado) };
  }
  if (f.cashAtivo && f.cashPct > 0) {
    const valor = round2(sale.total * f.cashPct / 100);
    if (valor > 0) { ganhos.cashback = valor; ganhos.cashValidade = plusDays(day, f.cashValidade);
      db.cashbacks.push({ id: ids(), clienteId: sale.clienteId, valor, saldo: valor, geradoEm: day, validade: ganhos.cashValidade, vendaId: sale.id }); }
  }
  return ganhos;
}
