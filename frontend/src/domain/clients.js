/* Regras e formatação de clientes. Funções puras, sem estado. */
import { parseDay, todayIso, curMonth } from './utils';

export const INACTIVE_DAYS = 60;
export const onlyDigits = v => String(v || '').replace(/\D/g, '');
export const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Máscara progressiva: (27) 9999-9999 com 10 dígitos, (27) 99999-9999 com 11
export const fone = v => { const d = onlyDigits(v).slice(0, 11); if (!d) return ''; if (d.length < 3) return '(' + d;
  const ddd = d.slice(0, 2), rest = d.slice(2); if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const cut = d.length === 11 ? 5 : 4; return `(${ddd}) ${rest.slice(0, cut)}-${rest.slice(cut)}`; };
export const nomeCompleto = c => `${c.nome} ${c.sobrenome}`;
export const idade = n => { const b = parseDay(n); const t = new Date(); let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth(); if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--; return a; };
export const dLong = n => parseDay(n).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
export const anivMes = c => c.nascimento.slice(5, 7) === curMonth.slice(5, 7);
export const anivHoje = c => c.nascimento.slice(5) === todayIso.slice(5);
export const waLink = (c, aniversario) => `https://wa.me/55${onlyDigits(c.telefone)}` + (aniversario
  ? '?text=' + encodeURIComponent(`Oi, ${c.nome}! A equipe Pocar Sport te deseja um feliz aniversário. Passa na loja este mês: tem um desconto especial te esperando.`) : '');
export const matchCliente = (c, q) => { const qd = onlyDigits(q); return norm(nomeCompleto(c)).includes(norm(q)) || (qd.length >= 3 && c.telefone.includes(qd)); };
