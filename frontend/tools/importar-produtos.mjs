// Gera os produtos e o estoque com que a loja começa, a partir da planilha "Produtos em estoque" exportada do PDV antigo.
// Uso:  npm run importar-produtos caminho/Produtos_em_estoque.xlsx
// Colunas esperadas na primeira linha: productName, variantName, quantity, costPrice, price.
// Saída: backend/src/main/resources/produtos-iniciais.json, que a API carrega na primeira subida (banco sem produtos)
// e no "Reiniciar dados". Rode de novo com a planilha atualizada antes de subir para produção.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import readXlsxFile from 'read-excel-file/node';
import { produtosDaPlanilha } from '../src/domain/importacao.js';

const arquivo = process.argv[2];
if (!arquivo) { console.error('Uso: npm run importar-produtos caminho/da/planilha.xlsx'); process.exit(1); }

const COLUNAS = ['productName', 'variantName', 'quantity', 'costPrice', 'price'];
const [planilha] = await readXlsxFile(arquivo); // primeira aba
const [cabecalho, ...dados] = planilha.data;
const faltando = COLUNAS.filter(c => !cabecalho.includes(c));
if (faltando.length) { console.error(`Colunas não encontradas na planilha: ${faltando.join(', ')}`); process.exit(1); }

const idx = Object.fromEntries(COLUNAS.map(c => [c, cabecalho.indexOf(c)]));
const linhas = dados
  .map(r => Object.fromEntries(COLUNAS.map(c => [c, r[idx[c]] ?? null])))
  .filter(l => l.productName && String(l.productName).trim());

const produtos = produtosDaPlanilha(linhas);
const destino = fileURLToPath(new URL('../../backend/src/main/resources/produtos-iniciais.json', import.meta.url));
writeFileSync(destino, JSON.stringify(produtos, null, 1) + '\n');
const variacoes = produtos.reduce((t, p) => t + p.variantes.length, 0);
const pecas = produtos.reduce((t, p) => t + p.variantes.reduce((a, v) => a + v.qtd, 0), 0);
console.log(`${produtos.length} produtos, ${variacoes} variações e ${pecas} peças em backend/src/main/resources/produtos-iniciais.json`);
console.log('Suba a API de novo (docker compose up -d --build). Em banco sem produtos ela carrega sozinha; com dados, use "Reiniciar dados".');
