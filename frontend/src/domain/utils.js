/* Datas, números e formatação. Funções puras, sem estado. */
import { COLORS } from './constants.js';

export const round2 = v => Math.round(v * 100) / 100;
export const pad = n => String(n).padStart(2, '0');
export const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const isoDateTime = d => `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const parseDay = s => new Date(s.slice(0,10) + 'T12:00:00');
export const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
export const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z]/g,'').slice(0,6).toUpperCase();
export const daysInMonth = m => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };
export const shiftMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; };
export function prng(seed){ return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
export const brlFmt = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
export const brl0Fmt = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 });
export const plusDays = (iso, n) => isoDate(addDays(parseDay(iso), n));
export const addMonthsIso = (iso, k) => { const d = parseDay(iso); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + k);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return isoDate(d); };
export const diffDays = (a, b) => Math.round((parseDay(a) - parseDay(b)) / 86400000);
export const sumTotal = arr => arr.reduce((s, x) => s + x.total, 0);
export const toggleArr = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); else arr.push(x); };

/* "Hoje" é calculado uma vez ao abrir o sistema, como no protótipo. */
export const todayIso = isoDate(startOfToday());
export const curMonth = todayIso.slice(0,7);
export const todayLong = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
export const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; })();
export const monthName = (m, withYear) => { const d = new Date(m + '-15T12:00:00'); const n = d.toLocaleDateString('pt-BR', { month: 'long' }); return withYear ? `${n} de ${d.getFullYear()}` : n; };

export const brl = v => brlFmt.format(v || 0);
export const brl0 = v => brl0Fmt.format(v || 0);
export const pct = v => (isFinite(v) ? (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0') + '%';
export const dShort = s => s ? parseDay(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
export const dtShort = s => `${dShort(s)} ${s.slice(11,16)}`;
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const colorOf = c => COLORS[c.toLowerCase()] || '#999';
