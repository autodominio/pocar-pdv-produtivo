/* Converte as linhas da planilha de estoque do PDV antigo (productName, variantName, quantity, costPrice, price)
   no formato de produtos do sistema. Funções puras: os dados vêm de src/domain/produtosLoja.json,
   gerado por "npm run importar-produtos planilha.xlsx". */
import { slug } from './utils.js';

const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'G3'];
const ORDEM_TAM = t => { const i = TAMANHOS.indexOf(t); return i < 0 ? 99 : i; };

/** Espaços extras fora e primeira letra maiúscula: " joelheira  Neoprene " -> "Joelheira Neoprene". */
export const limparNome = s => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};

/** Regatas NBA trazem o tamanho no nome ("Regata NBA phila 23 M", "Warriors 30M"): separa nome e tamanho. */
export function separarTamanhoDoNome(nome) {
  if (!/^regatas? nba/i.test(nome)) return { nome, tam: null };
  const base = nome.replace(/^regatas /i, 'Regata ');
  // tamanho no fim do nome, separado por espaço ("Vancouver M") ou colado no número ("Warriors 30M")
  const m = /^(.*\S)\s+(PP|P|M|G|GG|XG)$/.exec(base) || /^(.*\d)(PP|P|M|G|GG|XG)$/.exec(base);
  if (m) return { nome: limparNome(m[1]), tam: m[2] };
  // ou logo depois de "NBA" ("Regata NBA M usa 6")
  const d = /^(Regata NBA)\s+(PP|P|M|G|GG|XG)\s+(.+)$/i.exec(base);
  return d ? { nome: limparNome(`${d[1]} ${d[3]}`), tam: d[2] } : { nome: base, tam: null };
}

export function categoriaDe(nome) {
  const n = nome.toLowerCase();
  if (/^regata/.test(n)) return 'Regatas NBA';
  if (/^meia/.test(n)) return 'Meias';
  if (/dryfit|trydfit|dry fit/.test(n)) return 'Camisetas Dry Fit';
  if (/^camis/.test(n)) return 'Camisas de time';
  if (/joelheira|caneleira|cotoveleira|munhequeira|ombreira|manguito|kinesio|touca/.test(n)) return 'Proteção e suporte';
  if (/^fone/.test(n)) return 'Fones';
  return 'Acessórios';
}

/**
 * Agrupa as linhas por produto. A variação da planilha vira tamanho (P, M, G…) ou cor (Preta, Azul…);
 * sem variação, o produto fica com tamanho "Único" e cor "Única".
 * O custo do produto é a média ponderada pela quantidade, já que algumas variações têm custo diferente.
 */
export function produtosDaPlanilha(linhas, { prefixo = 'PL', min = 0 } = {}) {
  const grupos = new Map();
  for (const l of linhas) {
    const original = limparNome(l.productName);
    if (!original) continue;
    const { nome, tam: tamDoNome } = separarTamanhoDoNome(original);
    const variacao = limparNome(l.variantName);
    const ehTam = TAMANHOS.includes(variacao.toUpperCase());
    const tam = tamDoNome || (ehTam ? variacao.toUpperCase() : 'Único');
    const cor = !ehTam && variacao ? variacao : 'Única';
    const chave = nome.toLowerCase();
    if (!grupos.has(chave)) grupos.set(chave, { nome, linhas: [] });
    grupos.get(chave).linhas.push({ tam, cor, qtd: Math.max(0, Math.round(Number(l.quantity) || 0)), custo: Number(l.costPrice) || 0, preco: Number(l.price) || 0 });
  }

  let n = 0;
  return [...grupos.values()].map(g => {
    const id = prefixo + String(++n).padStart(3, '0');
    const variantes = new Map();
    for (const v of g.linhas) {
      const sku = `${id}-${v.tam === 'Único' ? 'U' : v.tam}-${slug(v.cor)}`;
      if (variantes.has(sku)) variantes.get(sku).qtd += v.qtd; // linha repetida na planilha: soma o estoque
      else variantes.set(sku, { sku, tam: v.tam, cor: v.cor, qtd: v.qtd, min });
    }
    const pecas = g.linhas.reduce((t, v) => t + v.qtd, 0);
    const custo = pecas ? g.linhas.reduce((t, v) => t + v.custo * v.qtd, 0) / pecas : g.linhas[0].custo;
    return {
      id, nome: g.nome, categoria: categoriaDe(g.nome),
      preco: Math.max(...g.linhas.map(v => v.preco)),
      custo: Math.round(custo * 100) / 100,
      variantes: [...variantes.values()].sort((a, b) => ORDEM_TAM(a.tam) - ORDEM_TAM(b.tam) || a.cor.localeCompare(b.cor)),
    };
  });
}
