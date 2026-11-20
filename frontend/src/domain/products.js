/* Consultas sobre produtos e variações (tamanho x cor). Funções puras, sem estado. */
export const stockOf = p => p.variantes.reduce((s, v) => s + v.qtd, 0);
export const tamsOf = p => [...new Set(p.variantes.map(v => v.tam))];
export const coresOf = p => [...new Set(p.variantes.map(v => v.cor))];
export const findVar = (p, t, c) => p.variantes.find(v => v.tam === t && v.cor === c);
export const qtyAt = (p, t, c) => { const v = findVar(p, t, c); return v ? v.qtd : 0; };
export const qClass = (p, t, c) => { const v = findVar(p, t, c); if (!v) return ''; return v.qtd === 0 ? 'zero' : v.qtd <= v.min ? 'low' : ''; };
export const statusOf = p => { const low = p.variantes.filter(v => v.qtd <= v.min).length; const zero = p.variantes.filter(v => v.qtd === 0).length;
  if (zero) return { label: `${zero} zerada${zero>1?'s':''}`, cls: 'neg' }; if (low) return { label: `${low} no mínimo`, cls: 'warn' }; return { label: 'OK', cls: 'pos' }; };
