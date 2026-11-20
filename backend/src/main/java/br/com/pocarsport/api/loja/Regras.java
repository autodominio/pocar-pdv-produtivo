package br.com.pocarsport.api.loja;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Regras de negócio puras (sem banco): valores, taxas, parcelas, encargos e códigos. */
public final class Regras {

    private Regras() {
    }

    public static final Map<String, String> FORMAS_PAGAMENTO = Map.of(
        "pix", "Pix", "credito", "Crédito", "debito", "Débito", "dinheiro", "Dinheiro", "crediario", "Crediário");
    /** Formas aceitas para entrada do crediário e recebimento de parcela. */
    public static final Set<String> FORMAS_RECEBIMENTO = Set.of("pix", "debito", "dinheiro");
    public static final Map<String, String> FORMAS_ESTORNO = Map.of("dinheiro", "Dinheiro", "pix", "Pix", "cartao", "Estorno no cartão");
    private static final Map<String, BigDecimal> TAXAS_CARTAO = Map.of(
        "pix", BigDecimal.ZERO, "dinheiro", BigDecimal.ZERO, "debito", new BigDecimal("0.0139"),
        "credito", new BigDecimal("0.0349"), "crediario", BigDecimal.ZERO);

    public static final int DIAS_RECEBER_CREDITO = 30;
    public static final int MAX_PARCELAS_CARTAO = 6;
    public static final BigDecimal DESCONTO_MAXIMO_PCT = new BigDecimal("30");
    public static final int VALIDADE_VALE_TROCA_DIAS = 90;
    public static final String CAT_ESTORNO = "Estornos a clientes";
    public static final String CAT_TAXAS = "Taxas de cartão";
    public static final String CAT_VENDAS = "Vendas na loja";
    public static final String CAT_CREDITO_RECEBER = "Cartão de crédito a receber";
    public static final String CAT_CREDIARIO_RECEBER = "Crediário a receber";
    public static final String CAT_ENCARGOS = "Juros e multa (crediário)";
    public static final String CAT_FORNECEDORES = "Fornecedores";
    public static final List<String> CAT_DESPESAS = List.of("Fornecedores", "Pessoal", "Ocupação", "Marketing", "Serviços", "Impostos", "Logística", "Outras despesas");
    public static final List<String> CAT_RECEITAS = List.of("Vendas externas", "Outras receitas");
    public static final List<String> TAMANHOS = List.of("PP", "P", "M", "G", "GG", "XG", "G1", "G2", "G3", "Único");

    // ------------------------------------------------------------------ valores

    public static BigDecimal r2(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal valor(Number n) {
        return n == null ? BigDecimal.ZERO : r2(new BigDecimal(n.toString()));
    }

    public static BigDecimal min(BigDecimal a, BigDecimal b) {
        return a.compareTo(b) <= 0 ? a : b;
    }

    public static BigDecimal max(BigDecimal a, BigDecimal b) {
        return a.compareTo(b) >= 0 ? a : b;
    }

    public static boolean positivo(BigDecimal v) {
        return v != null && v.signum() > 0;
    }

    public static String brl(BigDecimal v) {
        String s = r2(v.abs()).toPlainString();
        int ponto = s.indexOf('.');
        String inteiro = s.substring(0, ponto);
        StringBuilder milhar = new StringBuilder();
        for (int i = 0; i < inteiro.length(); i++) {
            if (i > 0 && (inteiro.length() - i) % 3 == 0) {
                milhar.append('.');
            }
            milhar.append(inteiro.charAt(i));
        }
        return (v.signum() < 0 ? "-R$ " : "R$ ") + milhar + "," + s.substring(ponto + 1);
    }

    /** Taxa da maquininha sobre um valor recebido na forma informada. */
    public static BigDecimal taxaCartao(String forma, BigDecimal valor) {
        return r2(valor.multiply(TAXAS_CARTAO.getOrDefault(forma, BigDecimal.ZERO)));
    }

    // ------------------------------------------------------------------ venda

    /** Desconto efetivo: percentual (até 30%) ou em reais, nunca maior que o subtotal. */
    public static BigDecimal desconto(BigDecimal subtotal, BigDecimal informado, boolean percentual) {
        BigDecimal d = max(BigDecimal.ZERO, informado == null ? BigDecimal.ZERO : informado);
        if (percentual && d.compareTo(DESCONTO_MAXIMO_PCT) > 0) {
            throw new RegraException("Desconto acima de 30% precisa de aprovação do gerente.");
        }
        BigDecimal valor = percentual ? subtotal.multiply(d).divide(new BigDecimal("100")) : d;
        return r2(min(subtotal, valor));
    }

    /** Valores da venda depois de desconto, vale, cashback e crédito de troca, nessa ordem. */
    public record Totais(BigDecimal subtotal, BigDecimal desconto, BigDecimal vale, BigDecimal cashback, BigDecimal troca, BigDecimal total,
                         BigDecimal sobraTroca) {
    }

    public static Totais totais(BigDecimal subtotal, BigDecimal desconto, BigDecimal valesSelecionados, BigDecimal cashbackDisponivel,
                                boolean usarCashback, BigDecimal creditoTroca) {
        BigDecimal aposDesconto = r2(subtotal.subtract(desconto));
        BigDecimal vale = r2(min(valesSelecionados, aposDesconto));
        BigDecimal cash = usarCashback ? r2(min(cashbackDisponivel, aposDesconto.subtract(vale))) : BigDecimal.ZERO.setScale(2);
        BigDecimal troca = creditoTroca == null ? BigDecimal.ZERO.setScale(2)
            : r2(max(BigDecimal.ZERO, min(creditoTroca, aposDesconto.subtract(vale).subtract(cash))));
        BigDecimal total = r2(aposDesconto.subtract(vale).subtract(cash).subtract(troca));
        BigDecimal sobra = creditoTroca == null ? BigDecimal.ZERO.setScale(2) : r2(creditoTroca.subtract(troca));
        return new Totais(r2(subtotal), r2(desconto), vale, cash, troca, total, sobra);
    }

    /** Quanto de cada real de preço o cliente pagou de fato (descontos e benefícios rateados). */
    public static BigDecimal valorPago(BigDecimal bruto, BigDecimal subtotalVenda, BigDecimal totalVenda) {
        return subtotalVenda.signum() > 0 ? r2(bruto.multiply(totalVenda).divide(subtotalVenda, 10, RoundingMode.HALF_UP)) : BigDecimal.ZERO.setScale(2);
    }

    /** Valor devolvido descontado só o desconto da venda (usado no resultado do mês). */
    public static BigDecimal valorLiquido(BigDecimal bruto, BigDecimal subtotalVenda, BigDecimal descontoVenda) {
        return subtotalVenda.signum() > 0
            ? r2(bruto.multiply(subtotalVenda.subtract(descontoVenda)).divide(subtotalVenda, 10, RoundingMode.HALF_UP))
            : BigDecimal.ZERO.setScale(2);
    }

    // ------------------------------------------------------------------ parcelas

    public record Parcela(int n, BigDecimal valor, LocalDate venc) {
    }

    /** Divide o valor em n parcelas mensais; a última absorve os centavos. */
    public static List<Parcela> planoParcelas(BigDecimal financiado, int n, LocalDate primeiroVenc) {
        BigDecimal base = financiado.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
        List<Parcela> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            BigDecimal v = i == n - 1 ? r2(financiado.subtract(base.multiply(BigDecimal.valueOf(n - 1L)))) : base;
            out.add(new Parcela(i + 1, v, somarMeses(primeiroVenc, i)));
        }
        return out;
    }

    /** Parcelas do cartão de crédito: a maquininha paga cada uma 30 dias depois da anterior. */
    public static List<Parcela> parcelasCartao(BigDecimal total, int n, LocalDate dia) {
        BigDecimal base = total.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
        List<Parcela> out = new ArrayList<>();
        for (int i = 1; i <= n; i++) {
            BigDecimal v = i == n ? r2(total.subtract(base.multiply(BigDecimal.valueOf(n - 1L)))) : base;
            out.add(new Parcela(i, v, dia.plusDays((long) DIAS_RECEBER_CREDITO * i)));
        }
        return out;
    }

    /** Mesmo dia nos meses seguintes; em mês mais curto, cai no último dia (31/01 -> 28/02). */
    public static LocalDate somarMeses(LocalDate data, int meses) {
        return data.plusMonths(meses);
    }

    public record Encargos(long dias, BigDecimal multa, BigDecimal juros) {
        public BigDecimal total() {
            return r2(multa.add(juros));
        }
    }

    /** Multa fixa e juros pró-rata por dia de atraso (juros ao mês / 30). */
    public static Encargos encargos(BigDecimal valor, LocalDate venc, LocalDate hoje, BigDecimal multaPct, BigDecimal jurosMesPct) {
        long dias = Math.max(0, ChronoUnit.DAYS.between(venc, hoje));
        if (dias == 0) {
            return new Encargos(0, BigDecimal.ZERO.setScale(2), BigDecimal.ZERO.setScale(2));
        }
        BigDecimal multa = r2(valor.multiply(multaPct).divide(new BigDecimal("100"), 10, RoundingMode.HALF_UP));
        BigDecimal juros = r2(valor.multiply(jurosMesPct).multiply(BigDecimal.valueOf(dias)).divide(new BigDecimal("3000"), 10, RoundingMode.HALF_UP));
        return new Encargos(dias, multa, juros);
    }

    // ------------------------------------------------------------------ produtos

    /** Parte da cor no SKU: sem acento, só letras, até 6, maiúsculas ("Azul Piscina" -> "AZULPI"). */
    public static String slug(String s) {
        String semAcento = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String letras = semAcento.replaceAll("[^A-Za-z]", "");
        return (letras.length() > 6 ? letras.substring(0, 6) : letras).toUpperCase();
    }

    public static String sku(String codigoProduto, String tamanho, String cor) {
        return codigoProduto + "-" + ("Único".equals(tamanho) ? "U" : tamanho) + "-" + slug(cor);
    }

    public static int ordemTamanho(String tamanho) {
        int i = TAMANHOS.indexOf(tamanho);
        return i < 0 ? 99 : i;
    }

    /** Dígito verificador do EAN-13. */
    public static int digitoEan13(String doze) {
        if (!doze.matches("\\d{12}")) {
            throw new IllegalArgumentException("O EAN-13 precisa de 12 dígitos antes do verificador.");
        }
        int soma = 0;
        for (int i = 0; i < 12; i++) {
            soma += (doze.charAt(i) - '0') * (i % 2 == 0 ? 1 : 3);
        }
        return (10 - soma % 10) % 10;
    }

    /** Código interno: prefixo 2 (uso interno da loja pelo padrão GS1) + 11 dígitos + verificador. */
    public static String codigoInterno(long sequencia) {
        String doze = "2" + String.format("%011d", sequencia);
        return doze + digitoEan13(doze);
    }
}
