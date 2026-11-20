package br.com.pocarsport.api.loja;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

class RegrasTest {

    private static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    @Test
    void descontoPercentualLimitadoA30() {
        assertEquals(d("8.97"), Regras.desconto(d("89.70"), d("10"), true));
        assertEquals(d("50.00"), Regras.desconto(d("50.00"), d("80"), false)); // em reais, nunca maior que o subtotal
        assertThrows(RegraException.class, () -> Regras.desconto(d("100"), d("31"), true));
    }

    @Test
    void totaisNaOrdemDescontoValeCashbackTroca() {
        Regras.Totais t = Regras.totais(d("339.80"), d("0.00"), d("100.00"), d("50.00"), true, null);
        assertEquals(d("100.00"), t.vale());
        assertEquals(d("50.00"), t.cashback());
        assertEquals(d("189.80"), t.total());
        Regras.Totais semSaldo = Regras.totais(d("89.70"), d("0.00"), d("100.00"), d("50.00"), true, null);
        assertEquals(d("89.70"), semSaldo.vale());
        assertEquals(d("0.00"), semSaldo.cashback());
        assertEquals(d("0.00"), semSaldo.total());
        Regras.Totais troca = Regras.totais(d("79.90"), d("0.00"), BigDecimal.ZERO, BigDecimal.ZERO, false, d("169.90"));
        assertEquals(d("79.90"), troca.troca());
        assertEquals(d("90.00"), troca.sobraTroca());
        assertEquals(d("0.00"), troca.total());
    }

    @Test
    void parcelasDoCrediarioUltimaAbsorveCentavos() {
        List<Regras.Parcela> p = Regras.planoParcelas(d("149.80"), 3, LocalDate.of(2026, 1, 31));
        assertEquals(d("49.93"), p.get(0).valor());
        assertEquals(d("49.94"), p.get(2).valor());
        assertEquals(LocalDate.of(2026, 2, 28), p.get(1).venc()); // 31/01 + 1 mês cai no último dia de fevereiro
        assertEquals(LocalDate.of(2026, 3, 31), p.get(2).venc());
    }

    @Test
    void parcelasDoCartaoACada30Dias() {
        List<Regras.Parcela> p = Regras.parcelasCartao(d("80.73"), 3, LocalDate.of(2026, 11, 15));
        assertEquals(d("26.91"), p.get(0).valor());
        assertEquals(d("26.91"), p.get(2).valor());
        assertEquals(LocalDate.of(2027, 2, 13), p.get(2).venc());
    }

    @Test
    void encargosPorAtraso() {
        Regras.Encargos e = Regras.encargos(d("49.93"), LocalDate.of(2026, 11, 5), LocalDate.of(2026, 11, 15), d("2"), d("1"));
        assertEquals(10L, e.dias());
        assertEquals(d("1.00"), e.multa());
        assertEquals(d("0.17"), e.juros());
        assertEquals(d("1.17"), e.total());
        assertEquals(d("0.00"), Regras.encargos(d("49.93"), LocalDate.of(2026, 11, 20), LocalDate.of(2026, 11, 15), d("2"), d("1")).total());
    }

    @Test
    void valorPagoRateiaDescontoEBeneficios() {
        assertEquals(d("152.91"), Regras.valorPago(d("169.90"), d("339.80"), d("305.82")));
        assertEquals(d("159.71"), Regras.valorLiquido(d("169.90"), d("339.80"), d("20.39")));
    }

    @Test
    void taxasDaMaquininha() {
        assertEquals(d("2.82"), Regras.taxaCartao("credito", d("80.73")));
        assertEquals(d("11.81"), Regras.taxaCartao("debito", d("849.50")));
        assertEquals(d("0.00"), Regras.taxaCartao("pix", d("849.50")));
    }

    @Test
    void codigosDeProduto() {
        assertEquals("AZULPI", Regras.slug("Azul Piscina"));
        assertEquals("UNICA", Regras.slug("Única"));
        assertEquals("PS001-U-PRETO", Regras.sku("PS001", "Único", "Preto"));
        assertEquals("2000000000015", Regras.codigoInterno(1));
        String c = Regras.codigoInterno(123);
        assertEquals(13, c.length());
        assertTrue(c.startsWith("2"));
        assertEquals(c.charAt(12) - '0', Regras.digitoEan13(c.substring(0, 12)));
    }

    @Test
    void formatoEmReais() {
        assertEquals("R$ 1.234,50", Regras.brl(d("1234.5")));
        assertEquals("-R$ 0,05", Regras.brl(d("-0.05")));
    }
}
