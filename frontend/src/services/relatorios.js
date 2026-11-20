/* Ponto único para os relatórios. Hoje o PDF é montado no navegador com os dados locais.
   Com o backend, troque o corpo de baixarRelatorioFinanceiro por um download de
   GET /api/relatorios/financeiro?inicio=...&fim=...&regime=...&formato=pdf
   e o resto do sistema (tela, botão, filtros) continua igual. */
import { montarRelatorioFinanceiro } from '@/domain/relatorios';
import { gerarRelatorioFinanceiroPdf } from './pdf/relatorioFinanceiroPdf';

export async function baixarRelatorioFinanceiro(db, filtros, meta) {
  const relatorio = montarRelatorioFinanceiro(db, filtros);
  return gerarRelatorioFinanceiroPdf(relatorio, meta);
}
