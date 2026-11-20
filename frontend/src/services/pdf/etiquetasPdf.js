/* PDF das etiquetas na folha A4, com o código de barras desenhado em vetor (nítido em qualquer impressora). */
import { brl } from '@/domain/utils';
import { barrasEan13, segmentosBarras, posicaoEtiqueta } from '@/domain/etiquetas';

const PT = 0.3528;                      // 1 ponto tipográfico em mm
const ZONA_SILENCIO = 9;                // módulos livres de cada lado, para o leitor achar o início
const MODULO_MAX = 0.33;                // largura nominal do módulo EAN-13 (100%)
const t = v => String(v ?? '').replace(/[\u00a0\u202f]/g, ' ').replace(/[\u2212\u2013\u2014]/g, '-').replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2026/g, '...');
const limitar = (v, min, max) => Math.max(min, Math.min(max, v));
const alturaLinha = pt => pt * PT * 1.18;

function desenharEtiqueta(doc, e, x, y, folha, campos, loja) {
  const w = folha.largura; const h = folha.altura; const pad = Math.min(1.4, h * 0.06);
  const larg = w - pad * 2; const cx = x + w / 2;
  const fNome = limitar(h * 0.31, 6, 9); const fVar = fNome - 1; const fPreco = limitar(h * 0.4, 8, 13);
  const fDig = limitar(h * 0.23, 4.8, 7); const fMini = limitar(h * 0.22, 4.5, 6.5);

  // Textos de cima, de baixo e o espaço que sobra para as barras
  const topo = []; const base = [];
  if (campos.loja && loja) topo.push({ texto: loja, fonte: fMini, estilo: 'normal' });
  if (campos.nome) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(fNome);
    doc.splitTextToSize(t(e.nome), larg).slice(0, h >= 25 ? 2 : 1).forEach(l => topo.push({ texto: l, fonte: fNome, estilo: 'bold' }));
  }
  if (campos.variacao && e.variacao) topo.push({ texto: e.variacao, fonte: fVar, estilo: 'normal' });
  if (campos.sku) base.push({ texto: e.sku, fonte: fMini, estilo: 'normal' });
  if (campos.preco) base.push({ texto: brl(e.preco), fonte: fPreco, estilo: 'bold' });

  let yAtual = y + pad;
  topo.forEach(l => {
    doc.setFont('helvetica', l.estilo); doc.setFontSize(l.fonte);
    yAtual += alturaLinha(l.fonte);
    doc.text(t(l.texto), cx, yAtual - l.fonte * PT * 0.22, { align: 'center', maxWidth: larg });
  });
  let yBase = y + h - pad;
  [...base].reverse().forEach(l => {
    doc.setFont('helvetica', l.estilo); doc.setFontSize(l.fonte);
    doc.text(t(l.texto), cx, yBase - l.fonte * PT * 0.22, { align: 'center', maxWidth: larg });
    yBase -= alturaLinha(l.fonte);
  });

  if (campos.codigoBarras && e.codigoBarras) {
    const espacoDig = alturaLinha(fDig);
    const alturaBarras = Math.min(yBase - yAtual - espacoDig - 0.4, h * 0.5);
    if (alturaBarras >= 3) {
      const modulo = Math.min(MODULO_MAX, larg / (95 + ZONA_SILENCIO * 2));
      const x0 = cx - (95 * modulo) / 2; const yBarras = yAtual + 0.4;
      doc.setFillColor(0, 0, 0);
      segmentosBarras(barrasEan13(e.codigoBarras)).forEach(s => doc.rect(x0 + s.inicio * modulo, yBarras, s.largura * modulo, alturaBarras, 'F'));
      doc.setFont('helvetica', 'normal'); doc.setFontSize(fDig);
      doc.text(e.codigoBarras, cx, yBarras + alturaBarras + espacoDig - fDig * PT * 0.22, { align: 'center', charSpace: 0.15 });
    }
  }
}

export async function gerarEtiquetasPdf({ etiquetas, folha, campos, inicio, ajusteX, ajusteY, contorno, loja }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setTextColor(0, 0, 0);
  let paginaAtual = 0;
  etiquetas.forEach((e, i) => {
    const pos = posicaoEtiqueta(folha, i, { inicio, ajusteX, ajusteY });
    while (paginaAtual < pos.pagina) { doc.addPage(); paginaAtual++; }
    if (contorno) { doc.setDrawColor(170, 170, 170); doc.setLineWidth(0.1); doc.roundedRect(pos.x, pos.y, folha.largura, folha.altura, 1.5, 1.5, 'S'); }
    desenharEtiqueta(doc, e, pos.x, pos.y, folha, campos, loja);
  });
  const hoje = new Date(); const arquivo = `etiquetas_${hoje.toISOString().slice(0, 10)}_${etiquetas.length}un.pdf`;
  doc.save(arquivo);
  return { arquivo, paginas: paginaAtual + 1 };
}
