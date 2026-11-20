package br.com.pocarsport.api.loja;

import static br.com.pocarsport.api.loja.Regras.brl;
import static br.com.pocarsport.api.loja.Regras.r2;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import br.com.pocarsport.api.auditoria.AuditoriaService;

/** Lançamentos (contas a pagar e receber), integração com o PDV, fechamento do mês e metas. */
@Service
public class FinanceiroService {

    private final Banco db;
    private final AuditoriaService auditoria;
    private final ObjectMapper json;

    public FinanceiroService(Banco db, AuditoriaService auditoria, ObjectMapper json) {
        this.db = db;
        this.auditoria = auditoria;
        this.json = json;
    }

    /** Lançamento a gravar. pago = true: entra como pago na própria data (pago_em = data). */
    public record NovoLancamento(LocalDate data, String origem, Long vendaId, Long crediarioId, Integer parcela, String tipo, String categoria,
                                 String descricao, BigDecimal valor, LocalDate venc, boolean pago, String forma, Long caixaId) {
    }

    long inserir(NovoLancamento l) {
        return db.inserir("insert into lancamento (data, origem, venda_id, crediario_id, parcela, tipo, categoria, descricao, valor, venc, status, pago_em, forma, caixa_id) "
                + "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            l.data(), l.origem(), l.vendaId(), l.crediarioId(), l.parcela(), l.tipo(), l.categoria(), cortar(l.descricao(), 300), r2(l.valor()), l.venc(),
            l.pago() ? "pago" : "pendente", l.pago() ? l.data() : null, l.pago() ? l.forma() : null, l.pago() ? l.caixaId() : null);
    }

    /**
     * Lançamentos de uma venda paga na hora (o crediário gera os seus no CrediarioService).
     * Crédito: uma conta a receber por parcela da maquininha. Demais formas: receita paga no caixa. Mais a taxa do cartão, se houver.
     * Devolve quantos lançamentos foram criados.
     */
    int lancamentosDaVenda(long vendaId, BigDecimal total, String pagamento, int parcelas, long caixaId, LocalDate hoje) {
        if (total.signum() <= 0 || "crediario".equals(pagamento)) {
            return 0; // venda paga inteira com vale/cashback/troca não gera receita
        }
        int n = 0;
        if ("credito".equals(pagamento)) {
            for (Regras.Parcela p : Regras.parcelasCartao(total, parcelas, hoje)) {
                boolean pago = !p.venc().isAfter(hoje);
                inserir(new NovoLancamento(hoje, "PDV", vendaId, null, null, "receita", Regras.CAT_CREDITO_RECEBER,
                    "Venda #" + vendaId + ", crédito " + p.n() + "/" + parcelas, p.valor(), p.venc(), pago, pagamento, caixaId));
                n++;
            }
        } else {
            inserir(new NovoLancamento(hoje, "PDV", vendaId, null, null, "receita", Regras.CAT_VENDAS,
                "Venda #" + vendaId + " (" + Regras.FORMAS_PAGAMENTO.get(pagamento) + ")", total, hoje, true, pagamento, caixaId));
            n++;
        }
        BigDecimal taxa = Regras.taxaCartao(pagamento, total);
        if (taxa.signum() > 0) {
            inserir(new NovoLancamento(hoje, "PDV", vendaId, null, null, "despesa", Regras.CAT_TAXAS,
                "Taxa " + Regras.FORMAS_PAGAMENTO.get(pagamento).toLowerCase() + " da venda #" + vendaId, taxa, hoje, true, pagamento, caixaId));
            n++;
        }
        return n;
    }

    /** Estorno ao cliente (devolução, cancelamento, sobra de troca): despesa paga na hora. */
    void estorno(long vendaId, BigDecimal valor, String forma, String descricao, Long caixaId, LocalDate hoje) {
        inserir(new NovoLancamento(hoje, "Devolução", vendaId, null, null, "despesa", Regras.CAT_ESTORNO, descricao, valor, hoje, true, forma, caixaId));
    }

    // ------------------------------------------------------------------ lançamento manual e baixa

    @Transactional
    public long lancamentoManual(Pedidos.Lancamento p, Contexto ctx) {
        if (!"despesa".equals(p.tipo()) && !"receita".equals(p.tipo())) {
            throw new RegraException("Escolha se é despesa ou receita.");
        }
        String descricao = CatalogoService.limpo(p.descricao());
        if (descricao.isEmpty()) {
            throw new RegraException("Informe a descrição.");
        }
        List<String> categorias = "despesa".equals(p.tipo()) ? Regras.CAT_DESPESAS : Regras.CAT_RECEITAS;
        if (!categorias.contains(p.categoria())) {
            throw new RegraException("Escolha uma categoria da lista.");
        }
        if (!Regras.positivo(p.valor())) {
            throw new RegraException("Informe o valor.");
        }
        if (p.venc() == null) {
            throw new RegraException("Informe o vencimento.");
        }
        boolean pago = "pago".equals(p.status());
        long id = inserir(new NovoLancamento(p.venc(), "Manual", null, null, null, p.tipo(), p.categoria(), descricao, r2(p.valor()), p.venc(), pago, null, null));
        auditoria.registrar(ctx.usuario(), "Lançamento criado", ("despesa".equals(p.tipo()) ? "Despesa" : "Receita") + ": " + descricao + ", " + brl(r2(p.valor())), null);
        return id;
    }

    /** Baixa de conta a pagar/receber. Parcela de crediário tem tela própria (com multa e juros). */
    @Transactional
    public void baixar(long id, Contexto ctx) {
        Map<String, Object> l = db.um("select * from lancamento where id = ? for update", id)
            .orElseThrow(() -> new RegraException("Lançamento não encontrado."));
        if (Banco.id(l, "crediario_id") != null && Banco.id(l, "parcela") != null) {
            throw new RegraException("Parcela de crediário: use \"Receber\" na tela do crediário.");
        }
        if (!"pendente".equals(Banco.txt(l, "status"))) {
            throw new RegraException("Esta conta não está em aberto.");
        }
        db.executar("update lancamento set status = 'pago', pago_em = ? where id = ?", ctx.hoje(), id);
        boolean despesa = "despesa".equals(Banco.txt(l, "tipo"));
        auditoria.registrar(ctx.usuario(), despesa ? "Conta paga" : "Conta recebida", Banco.txt(l, "descricao") + ", " + brl(Banco.dec(l, "valor")), null);
    }

    // ------------------------------------------------------------------ metas e fechamento

    @Transactional
    public void definirMeta(String mes, BigDecimal valor, Contexto ctx) {
        YearMonth m = mes(mes);
        if (valor == null || valor.signum() <= 0) {
            throw new RegraException("Informe a meta do mês.");
        }
        db.executar("insert into meta_mes (mes, valor) values (?, ?) on conflict (mes) do update set valor = excluded.valor", m.toString(), r2(valor));
        auditoria.registrar(ctx.usuario(), "Metas alteradas", "Meta da loja: " + brl(r2(valor)), null);
    }

    /** Resultado (lucro) do mês por competência: o mesmo cálculo do DRE e do lucro mensal das telas. */
    public Map<String, Object> resultado(String mes) {
        YearMonth m = mes(mes);
        LocalDate ini = m.atDay(1);
        LocalDate fim = m.plusMonths(1).atDay(1);
        Map<String, Object> v = db.um("select count(*) as vendas, coalesce(sum(subtotal), 0) as bruta, coalesce(sum(desconto), 0) as descontos, "
            + "coalesce(sum(vale_usado + cashback_usado), 0) as fidelidade from venda where status <> 'cancelada' and data >= ? and data < ?", ini, fim).orElseThrow();
        BigDecimal cmvVendas = db.soma("select sum(i.custo * i.qtd) from venda_item i join venda s on s.id = i.venda_id "
            + "where s.status <> 'cancelada' and s.data >= ? and s.data < ?", ini, fim);
        BigDecimal devolucoes = db.soma("select sum(valor_liquido) from devolucao where data >= ? and data < ?", ini, fim);
        BigDecimal cmvDevolvido = db.soma("select sum(di.custo * di.qtd) from devolucao_item di join devolucao d on d.id = di.devolucao_id "
            + "where d.data >= ? and d.data < ?", ini, fim);
        BigDecimal taxas = db.soma("select sum(valor) from lancamento where tipo = 'despesa' and categoria = ? and data >= ? and data < ?", Regras.CAT_TAXAS, ini, fim);
        BigDecimal encargos = db.soma("select sum(valor) from lancamento where tipo = 'receita' and categoria = ? and data >= ? and data < ?", Regras.CAT_ENCARGOS, ini, fim);
        List<Map<String, Object>> despesas = new ArrayList<>();
        BigDecimal totalDespesas = BigDecimal.ZERO.setScale(2);
        for (Map<String, Object> d : db.lista("select categoria, sum(valor) as valor from lancamento where tipo = 'despesa' and status <> 'cancelado' "
            + "and categoria not in (?, ?, ?) and data >= ? and data < ? group by categoria order by 2 desc", Regras.CAT_TAXAS, Regras.CAT_FORNECEDORES, Regras.CAT_ESTORNO, ini, fim)) {
            BigDecimal valor = Banco.dec(d, "valor");
            Map<String, Object> linha = new LinkedHashMap<>();
            linha.put("cat", Banco.txt(d, "categoria"));
            linha.put("valor", valor);
            despesas.add(linha);
            totalDespesas = totalDespesas.add(valor);
        }
        BigDecimal bruta = Banco.dec(v, "bruta");
        BigDecimal liquida = bruta.subtract(Banco.dec(v, "descontos")).subtract(Banco.dec(v, "fidelidade")).subtract(devolucoes);
        BigDecimal cmv = cmvVendas.subtract(cmvDevolvido);
        BigDecimal lucroBruto = liquida.subtract(cmv).subtract(taxas);
        BigDecimal resultado = lucroBruto.subtract(totalDespesas).add(encargos);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("vendas", Banco.inteiro(v, "vendas"));
        r.put("bruta", bruta);
        r.put("descontos", Banco.dec(v, "descontos"));
        r.put("fidelidade", Banco.dec(v, "fidelidade"));
        r.put("devolucoes", devolucoes);
        r.put("liquida", r2(liquida));
        r.put("cmv", r2(cmv));
        r.put("taxas", taxas);
        r.put("lucroBruto", r2(lucroBruto));
        r.put("despesas", despesas);
        r.put("totalDespesas", r2(totalDespesas));
        r.put("encargos", encargos);
        r.put("resultado", r2(resultado));
        r.put("margem", liquida.signum() > 0 ? resultado.divide(liquida, 4, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        return r;
    }

    /** Registra o lucro do mês como estava no dia do fechamento. Fechar de novo atualiza o registro. */
    @Transactional
    public void fecharMes(String mes, String obs, Contexto ctx) {
        YearMonth m = mes(mes);
        if (m.isAfter(YearMonth.from(ctx.hoje()))) {
            throw new RegraException("Não dá para fechar um mês que ainda não começou.");
        }
        Map<String, Object> r = resultado(mes);
        String despesas;
        try {
            despesas = json.writeValueAsString(r.get("despesas"));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        db.executar("insert into fechamento_mes (mes, vendas, bruta, descontos, fidelidade, devolucoes, liquida, cmv, taxas, lucro_bruto, total_despesas, "
                + "encargos, resultado, margem, despesas, fechado_em, fechado_por, obs) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?) "
                + "on conflict (mes) do update set vendas = excluded.vendas, bruta = excluded.bruta, descontos = excluded.descontos, fidelidade = excluded.fidelidade, "
                + "devolucoes = excluded.devolucoes, liquida = excluded.liquida, cmv = excluded.cmv, taxas = excluded.taxas, lucro_bruto = excluded.lucro_bruto, "
                + "total_despesas = excluded.total_despesas, encargos = excluded.encargos, resultado = excluded.resultado, margem = excluded.margem, "
                + "despesas = excluded.despesas, fechado_em = excluded.fechado_em, fechado_por = excluded.fechado_por, obs = excluded.obs",
            m.toString(), r.get("vendas"), r.get("bruta"), r.get("descontos"), r.get("fidelidade"), r.get("devolucoes"), r.get("liquida"), r.get("cmv"),
            r.get("taxas"), r.get("lucroBruto"), r.get("totalDespesas"), r.get("encargos"), r.get("resultado"), r.get("margem"), despesas,
            ctx.hoje(), ctx.nome(), cortar(CatalogoService.limpo(obs), 500));
        auditoria.registrar(ctx.usuario(), "Mês fechado", m + ": lucro de " + brl((BigDecimal) r.get("resultado")), null);
    }

    static YearMonth mes(String mes) {
        try {
            return YearMonth.parse(mes);
        } catch (RuntimeException e) {
            throw new RegraException("Mês inválido.");
        }
    }

    static String cortar(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
