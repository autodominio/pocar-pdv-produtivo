/* Monta o PDF do relatório financeiro (jsPDF + jspdf-autotable).
   As bibliotecas são carregadas só quando o usuário pede o PDF, para não pesar a abertura do sistema. */
import logoUrl from '@/assets/logo.png';
import { brl, dShort, pct, cap } from '@/domain/utils';

const COR = { preto: [0, 0, 0], amarelo: [251, 214, 37], texto: [17, 17, 17], muted: [102, 102, 98], linha: [222, 222, 218], fundo: [244, 244, 241], verde: [17, 121, 58], vermelho: [180, 33, 41] };
const MARGEM = 14;
const LOGO_PROPORCAO = 217 / 660;

/* As fontes padrão do PDF usam a codificação WinAnsi: troca o que ela não tem por equivalentes. */
const t = v => String(v ?? '').replace(/[\u00a0\u202f]/g, ' ').replace(/[\u2212\u2013\u2014]/g, '-').replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2026/g, '...');
const dataBr = iso => `${dShort(iso)}/${iso.slice(0, 4)}`;

async function carregarLogo() {
  const blob = await (await fetch(logoUrl)).blob();
  return new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsDataURL(blob); });
}

export function nomeDoArquivo(rel) {
  return `relatorio-financeiro_${rel.inicio}_a_${rel.fim}_${rel.regime}.pdf`;
}

export async function gerarRelatorioFinanceiroPdf(rel, { loja, emitidoPor }) {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([import('jspdf'), import('jspdf-autotable'), carregarLogo()]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
  const larguraUtil = W - MARGEM * 2;
  const caixa = rel.regime === 'caixa';
  const agora = new Date();

  /* ---------- cabeçalho ---------- */
  doc.setFillColor(...COR.preto); doc.rect(0, 0, W, 32, 'F');
  doc.setFillColor(...COR.amarelo); doc.rect(0, 32, W, 1.6, 'F');
  doc.addImage(logo, 'PNG', MARGEM, 7, 56, 56 * LOGO_PROPORCAO, 'logo', 'FAST');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(t('Relatório financeiro'), W - MARGEM, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...COR.amarelo);
  doc.text(t('Entradas e saídas'), W - MARGEM, 21.5, { align: 'right' });

  let y = 42;
  doc.setTextColor(...COR.texto); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(t(`Período: ${dataBr(rel.inicio)} a ${dataBr(rel.fim)}   |   ${rel.regimeLabel}`), MARGEM, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...COR.muted);
  y += 5;
  doc.text(t(`${loja}. Emitido em ${dataBr(agora.toISOString())} às ${agora.toTimeString().slice(0, 5)} por ${emitidoPor}.`), MARGEM, y);
  y += 4.5;
  doc.text(t(caixa ? 'Caixa: considera a data em que o dinheiro entrou ou saiu; só entra o que já foi pago ou recebido.'
                   : 'Competência: considera a data da venda ou da despesa, mesmo que o pagamento aconteça em outro mês.'), MARGEM, y);

  /* ---------- quadros de resumo ---------- */
  y += 6;
  const quadros = caixa
    ? [['Saldo no início', rel.totais.saldoInicial, null], ['Entradas', rel.totais.entradas, 'pos'], ['Saídas', rel.totais.saidas, 'neg'], ['Saldo no fim', rel.totais.saldoFinal, rel.totais.saldoFinal >= 0 ? 'pos' : 'neg']]
    : [['Entradas', rel.totais.entradas, 'pos'], ['Saídas', rel.totais.saidas, 'neg'], ['Resultado do período', rel.totais.resultado, rel.totais.resultado >= 0 ? 'pos' : 'neg'], ['Lançamentos', null, null]];
  const gap = 3; const qw = (larguraUtil - gap * 3) / 4;
  quadros.forEach(([rotulo, valor, tom], i) => {
    const x = MARGEM + i * (qw + gap);
    doc.setFillColor(...COR.fundo); doc.roundedRect(x, y, qw, 18, 1.5, 1.5, 'F');
    doc.setFontSize(8); doc.setTextColor(...COR.muted); doc.setFont('helvetica', 'normal'); doc.text(t(rotulo), x + 3.5, y + 6);
    doc.setFontSize(12.5); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(tom === 'pos' ? COR.verde : tom === 'neg' ? COR.vermelho : COR.texto));
    doc.text(t(valor === null ? String(rel.totais.qtdLancamentos) : brl(valor)), x + 3.5, y + 13.5);
  });
  y += 26;

  const titulo = (texto, yy) => {
    doc.setFillColor(...COR.amarelo); doc.rect(MARGEM, yy - 3.6, 1.6, 4.6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...COR.texto); doc.text(t(texto), MARGEM + 4, yy);
    return yy + 3;
  };
  const novaSecao = (yy, alturaMinima = 30) => { if (yy + alturaMinima > H - 18) { doc.addPage(); return MARGEM + 6; } return yy; };
  const estiloBase = {
    theme: 'plain', styles: { font: 'helvetica', fontSize: 8.5, cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 }, textColor: COR.texto, lineColor: COR.linha, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: COR.preto, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: COR.fundo, textColor: COR.texto, fontStyle: 'bold' },
    margin: { left: MARGEM, right: MARGEM, top: MARGEM, bottom: 18 },
    showFoot: 'lastPage',
  };
  const tabelaCategoria = (dados, cab, x, larg, yy) => {
    autoTable(doc, { ...estiloBase, startY: yy, margin: { ...estiloBase.margin, left: x }, tableWidth: larg,
      head: [[t(cab), 'Valor', '%']],
      body: dados.length ? dados.map(d => [t(d.nome), t(brl(d.valor)), t(pct(d.share))]) : [[t('Nada no período'), '', '']],
      foot: [[t('Total'), t(brl(dados.reduce((s, d) => s + d.valor, 0))), dados.length ? '100%' : '']],
      columnStyles: { 1: { halign: 'right', cellWidth: 28 }, 2: { halign: 'right', cellWidth: 12 } },
      didParseCell: c => { if (c.column.index > 0 && c.section !== 'body' ) c.cell.styles.halign = 'right'; } });
    return doc.lastAutoTable.finalY;
  };

  /* ---------- por categoria (lado a lado) ---------- */
  y = titulo('Resumo por categoria', novaSecao(y));
  const meia = (larguraUtil - 6) / 2;
  const fimEntradas = tabelaCategoria(rel.entradasPorCategoria, 'Entradas', MARGEM, meia, y);
  const fimSaidas = tabelaCategoria(rel.saidasPorCategoria, 'Saídas', MARGEM + meia + 6, meia, y);
  y = Math.max(fimEntradas, fimSaidas) + 10;

  /* ---------- entradas por forma de pagamento ---------- */
  y = titulo('Entradas por forma de pagamento', novaSecao(y));
  y = tabelaCategoria(rel.entradasPorForma, 'Forma de pagamento', MARGEM, larguraUtil, y) + 10;

  /* ---------- lançamentos ---------- */
  y = titulo('Lançamentos do período', novaSecao(y, 40));
  const cab = ['Data', 'Descrição', 'Categoria', 'Situação', 'Entrada', 'Saída'];
  if (caixa) cab.push('Saldo');
  autoTable(doc, { ...estiloBase, startY: y, head: [cab.map(t)],
    body: rel.linhas.length ? rel.linhas.map(l => {
      const linha = [dShort(l.data), t(l.descricao), t(l.categoria), t(l.situacao), l.entrada ? t(brl(l.entrada)) : '', l.saida ? t(brl(l.saida)) : ''];
      if (caixa) linha.push(t(brl(l.saldo)));
      return linha;
    }) : [[{ content: t('Nenhum lançamento no período.'), colSpan: cab.length, styles: { halign: 'center', textColor: COR.muted } }]],
    foot: rel.linhas.length ? [[{ content: t(`Totais (${rel.totais.qtdLancamentos} lançamentos)`), colSpan: 4 }, t(brl(rel.totais.entradas)), t(brl(rel.totais.saidas)), ...(caixa ? [t(brl(rel.totais.saldoFinal))] : [])]] : undefined,
    styles: { ...estiloBase.styles, fontSize: 7.6 },
    columnStyles: { 0: { cellWidth: 12 }, 2: { cellWidth: 32 }, 3: { cellWidth: 17 }, 4: { halign: 'right', cellWidth: 22 }, 5: { halign: 'right', cellWidth: 22 }, 6: { halign: 'right', cellWidth: 24 } },
    didParseCell: c => {
      if (c.section !== 'body') { if (c.column.index >= 4) c.cell.styles.halign = 'right'; return; }
      if (c.column.index === 4 && c.cell.raw) c.cell.styles.textColor = COR.verde;
      if (c.column.index === 5 && c.cell.raw) c.cell.styles.textColor = COR.vermelho;
      if (c.row.index % 2 === 1) c.cell.styles.fillColor = [250, 250, 248];
    } });
  y = doc.lastAutoTable.finalY + 10;

  /* ---------- contas em aberto ---------- */
  if (rel.abertos.length) {
    y = titulo('Contas em aberto que vencem no período', novaSecao(y, 40));
    autoTable(doc, { ...estiloBase, startY: y, head: [['Vencimento', t('Descrição'), 'Categoria', 'A receber', 'A pagar'].map(t)],
      body: rel.abertos.map(a => [dataBr(a.venc), t(a.descricao), t(a.categoria), a.tipo === 'receita' ? t(brl(a.valor)) : '', a.tipo === 'despesa' ? t(brl(a.valor)) : '']),
      foot: [[{ content: 'Totais', colSpan: 3 }, t(brl(rel.totalAbertos.receber)), t(brl(rel.totalAbertos.pagar))]],
      styles: { ...estiloBase.styles, fontSize: 7.6 },
      columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 34 }, 3: { halign: 'right', cellWidth: 24 }, 4: { halign: 'right', cellWidth: 24 } },
      didParseCell: c => { if (c.section !== 'body' && c.column.index >= 3) c.cell.styles.halign = 'right'; } });
  }

  /* ---------- rodapé em todas as páginas ---------- */
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COR.linha); doc.setLineWidth(0.2); doc.line(MARGEM, H - 12, W - MARGEM, H - 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...COR.muted);
    doc.text(t(`${loja} | Relatório financeiro de ${dataBr(rel.inicio)} a ${dataBr(rel.fim)} | ${cap(rel.regimeLabel.toLowerCase())}`), MARGEM, H - 7.5);
    doc.text(t(`Página ${i} de ${total}`), W - MARGEM, H - 7.5, { align: 'right' });
  }

  const arquivo = nomeDoArquivo(rel);
  doc.save(arquivo);
  return arquivo;
}
