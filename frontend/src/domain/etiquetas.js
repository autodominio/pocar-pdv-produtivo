/* Códigos de barras (EAN-13 de uso interno) e montagem das folhas de etiquetas. Funções puras. */

/* ---------- EAN-13 ---------- */
// O prefixo 2 (faixa 200–299) é reservado pelo padrão GS1 para uso interno da loja: não colide com códigos de fabricantes.
export const PREFIXO_INTERNO = '2';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARIDADE = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLG', 'LGLGLL', 'LGLGGL', 'LGGLGL'];

export function digitoEan13(doze) {
  if (!/^\d{12}$/.test(doze)) throw new Error('O EAN-13 precisa de 12 dígitos antes do verificador.');
  const soma = [...doze].reduce((t, d, i) => t + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (soma % 10)) % 10);
}

export const ean13Valido = codigo => /^\d{13}$/.test(codigo) && digitoEan13(codigo.slice(0, 12)) === codigo[12];

/* Código interno a partir de um número sequencial: 2 + 11 dígitos + verificador. */
export function codigoInterno(sequencia) {
  const doze = PREFIXO_INTERNO + String(sequencia).padStart(11, '0');
  return doze + digitoEan13(doze);
}

/* Sequência de 95 módulos ("1" = barra, "0" = espaço) para desenhar o código. */
export function barrasEan13(codigo) {
  if (!ean13Valido(codigo)) throw new Error(`Código de barras inválido: ${codigo}`);
  const d = [...codigo].map(Number); const paridade = PARIDADE[d[0]];
  let s = '101';
  for (let i = 1; i <= 6; i++) s += (paridade[i - 1] === 'L' ? L : G)[d[i]];
  s += '01010';
  for (let i = 7; i <= 12; i++) s += R[d[i]];
  return s + '101';
}

/* Agrupa os módulos em barras contínuas: [{ inicio, largura }] em unidades de módulo. */
export function segmentosBarras(modulos) {
  const out = []; let i = 0;
  while (i < modulos.length) {
    if (modulos[i] === '1') { const ini = i; while (modulos[i] === '1') i++; out.push({ inicio: ini, largura: i - ini }); } else i++;
  }
  return out;
}

/* Dá código de barras a toda variação que ainda não tem. Retorna quantas recebeu. */
export function garantirCodigos(db) {
  if (!db.nextCodigo) db.nextCodigo = 1;
  const usados = new Set(); db.products.forEach(p => p.variantes.forEach(v => { if (v.codigoBarras) usados.add(v.codigoBarras); }));
  let novos = 0;
  db.products.forEach(p => p.variantes.forEach(v => {
    if (v.codigoBarras) return;
    let c; do { c = codigoInterno(db.nextCodigo++); } while (usados.has(c));
    v.codigoBarras = c; usados.add(c); novos++;
  }));
  return novos;
}

/* ---------- Folhas de etiquetas (A4, medidas em mm) ---------- */
export const FOLHAS = [
  { id: 'A4351', nome: 'A4351 (Pimaco, Green Paper e similares)', desc: '38,1 × 21,2 mm · 65 por folha (5 colunas × 13 linhas)',
    largura: 38.1, altura: 21.2, colunas: 5, linhas: 13, margemEsq: 4.7, margemSup: 10.7, passoH: 40.6, passoV: 21.2 },
  { id: 'A4356', nome: 'A4356 (Pimaco e similares)', desc: '63,5 × 25,4 mm · 33 por folha (3 colunas × 11 linhas)',
    largura: 63.5, altura: 25.4, colunas: 3, linhas: 11, margemEsq: 7.2, margemSup: 8.8, passoH: 66.0, passoV: 25.4 },
  { id: 'A4360', nome: 'A4360 (Pimaco e similares)', desc: '63,5 × 38,1 mm · 21 por folha (3 colunas × 7 linhas)',
    largura: 63.5, altura: 38.1, colunas: 3, linhas: 7, margemEsq: 7.2, margemSup: 15.15, passoH: 66.0, passoV: 38.1 },
];
export const porFolha = f => f.colunas * f.linhas;

/* Posição da etiqueta de número `indice` (0, 1, 2…), contando a partir da posição inicial escolhida na 1ª folha. */
export function posicaoEtiqueta(folha, indice, { inicio = 1, ajusteX = 0, ajusteY = 0 } = {}) {
  const n = indice + (inicio - 1); const cap = porFolha(folha);
  const pagina = Math.floor(n / cap); const naFolha = n % cap;
  const linha = Math.floor(naFolha / folha.colunas); const coluna = naFolha % folha.colunas;
  return { pagina, x: folha.margemEsq + coluna * folha.passoH + ajusteX, y: folha.margemSup + linha * folha.passoV + ajusteY };
}

/* Lista de etiquetas a imprimir: uma por unidade, na ordem dos produtos. qtds = { sku: quantidade } */
export function montarEtiquetas(products, qtds) {
  const out = [];
  products.forEach(p => p.variantes.forEach(v => {
    const n = Math.max(0, Math.floor(Number(qtds[v.sku]) || 0));
    for (let i = 0; i < n; i++) out.push({ nome: p.nome, variacao: v.tam === 'Único' ? v.cor : `${v.tam}, ${v.cor}`, preco: p.preco, sku: v.sku, codigoBarras: v.codigoBarras });
  }));
  return out;
}

export const totalFolhas = (folha, total, inicio = 1) => total ? Math.ceil((total + inicio - 1) / porFolha(folha)) : 0;
