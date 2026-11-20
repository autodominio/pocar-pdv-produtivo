package br.com.pocarsport.api.loja;

import static br.com.pocarsport.api.loja.Regras.brl;
import static br.com.pocarsport.api.loja.Regras.r2;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.pocarsport.api.auditoria.AuditoriaService;

/** Crediário próprio: carnê, situação de crédito do cliente e recebimento de parcelas com multa e juros. */
@Service
public class CrediarioService {

    private final Banco db;
    private final AuditoriaService auditoria;
    private final FinanceiroService financeiro;
    private final CaixaService caixa;
    private final ClienteService clientes;

    public CrediarioService(Banco db, AuditoriaService auditoria, FinanceiroService financeiro, CaixaService caixa, ClienteService clientes) {
        this.db = db;
        this.auditoria = auditoria;
        this.financeiro = financeiro;
        this.caixa = caixa;
        this.clientes = clientes;
    }

    record Config(int maxParcelas, BigDecimal limitePadrao, BigDecimal multa, BigDecimal jurosMes, int primeiroVencDias) {
    }

    Config config() {
        Map<String, Object> c = db.um("select * from configuracao where id = 1").orElseThrow();
        return new Config(Banco.inteiro(c, "cred_max_parcelas"), Banco.dec(c, "cred_limite_padrao"), Banco.dec(c, "cred_multa_pct"),
            Banco.dec(c, "cred_juros_mes_pct"), Banco.inteiro(c, "cred_primeiro_venc_dias"));
    }

    record Situacao(BigDecimal emAberto, BigDecimal limite, BigDecimal disponivel, LocalDate atrasoDesde) {
    }

    /** Quanto o cliente deve, quanto ainda pode parcelar e desde quando está em atraso. Trava o cliente até o fim da transação. */
    Situacao situacao(long clienteId, LocalDate hoje) {
        Map<String, Object> c = db.um("select limite_credito from cliente where id = ? for update", clienteId)
            .orElseThrow(() -> new RegraException("Cliente não encontrado."));
        Map<String, Object> s = db.um("select coalesce(sum(p.valor), 0) as em_aberto, min(p.venc) filter (where p.venc < ?) as atraso_desde "
            + "from crediario_parcela p join crediario c on c.id = p.crediario_id "
            + "where c.cliente_id = ? and p.pago_em is null and p.cancelada_em is null", hoje, clienteId).orElseThrow();
        BigDecimal limite = Banco.dec(c, "limite_credito") != null ? Banco.dec(c, "limite_credito") : config().limitePadrao();
        BigDecimal emAberto = Banco.dec(s, "em_aberto");
        return new Situacao(emAberto, limite, Regras.max(BigDecimal.ZERO, limite.subtract(emAberto)), Banco.dia(s, "atraso_desde"));
    }

    /** Confere se a venda pode ser no crediário. Devolve o plano de parcelas. */
    List<Regras.Parcela> validarVenda(Long clienteId, BigDecimal total, Pedidos.CrediarioVenda p, LocalDate hoje) {
        if (clienteId == null) {
            throw new RegraException("Selecione o cliente para vender no crediário.");
        }
        if (p == null) {
            throw new RegraException("Informe as parcelas do crediário.");
        }
        Config cfg = config();
        Situacao st = situacao(clienteId, hoje);
        if (st.atrasoDesde() != null) {
            throw new RegraException("Cliente com parcela atrasada desde " + String.format("%02d/%02d", st.atrasoDesde().getDayOfMonth(), st.atrasoDesde().getMonthValue())
                + ". Receba antes de vender no crediário.");
        }
        BigDecimal entrada = p.entrada() == null ? BigDecimal.ZERO : r2(p.entrada());
        if (entrada.signum() < 0) {
            throw new RegraException("A entrada não pode ser negativa.");
        }
        if (entrada.compareTo(total) >= 0) {
            throw new RegraException("A entrada cobre a compra toda: escolha outra forma de pagamento.");
        }
        if (entrada.signum() > 0 && !Regras.FORMAS_RECEBIMENTO.contains(p.entradaForma())) {
            throw new RegraException("Escolha como a entrada foi paga.");
        }
        int n = p.parcelas() == null ? 0 : p.parcelas();
        if (n < 1 || n > cfg.maxParcelas()) {
            throw new RegraException("O crediário vai de 1 a " + cfg.maxParcelas() + " parcelas.");
        }
        BigDecimal financiado = r2(total.subtract(entrada));
        if (financiado.compareTo(st.disponivel()) > 0) {
            throw new RegraException("Valor parcelado acima do limite disponível (" + brl(st.disponivel()) + ").");
        }
        if (p.primeiroVenc() == null || p.primeiroVenc().isBefore(hoje)) {
            throw new RegraException("Informe a data do 1º vencimento.");
        }
        return Regras.planoParcelas(financiado, n, p.primeiroVenc());
    }

    /** Cria o carnê da venda, a entrada (paga no caixa) e uma conta a receber por parcela. Devolve o id do carnê e quantos lançamentos criou. */
    long[] criar(long vendaId, long clienteId, BigDecimal total, BigDecimal entrada, String entradaForma, List<Regras.Parcela> plano, long caixaId, LocalDate hoje) {
        long credId = db.inserir("insert into crediario (venda_id, cliente_id, data, total, entrada, entrada_forma) values (?, ?, ?, ?, ?, ?)",
            vendaId, clienteId, hoje, total, entrada, entrada.signum() > 0 ? entradaForma : null);
        int lancs = 0;
        if (entrada.signum() > 0) {
            financeiro.inserir(new FinanceiroService.NovoLancamento(hoje, "PDV", vendaId, null, null, "receita", Regras.CAT_VENDAS,
                "Venda #" + vendaId + ", entrada do crediário (" + Regras.FORMAS_PAGAMENTO.get(entradaForma) + ")", entrada, hoje, true, entradaForma, caixaId));
            lancs++;
        }
        String nome = clientes.nomeCompleto(clienteId);
        for (Regras.Parcela p : plano) {
            db.executar("insert into crediario_parcela (crediario_id, n, valor, venc) values (?, ?, ?, ?)", credId, p.n(), p.valor(), p.venc());
            financeiro.inserir(new FinanceiroService.NovoLancamento(hoje, "Crediário", vendaId, credId, p.n(), "receita", Regras.CAT_CREDIARIO_RECEBER,
                "Crediário " + nome + ", venda #" + vendaId + ", parcela " + p.n() + "/" + plano.size(), p.valor(), p.venc(), false, null, null));
            lancs++;
        }
        return new long[] {credId, lancs};
    }

    /** Recebe uma parcela, com multa e juros por atraso se cobrados. Dinheiro exige caixa aberto. */
    @Transactional
    public Map<String, Object> receber(long credId, int n, Pedidos.RecebimentoParcela p, Contexto ctx) {
        String forma = p.forma();
        if (!Regras.FORMAS_RECEBIMENTO.contains(forma)) {
            throw new RegraException("Escolha a forma de recebimento.");
        }
        Long caixaId = caixa.abertoTravado().orElse(null); // caixa antes da parcela, como nas outras operações
        Map<String, Object> pa = db.um("select p.*, c.venda_id, c.cliente_id, (select count(*) from crediario_parcela x where x.crediario_id = c.id) as qtd "
            + "from crediario_parcela p join crediario c on c.id = p.crediario_id where p.crediario_id = ? and p.n = ? for update of p", credId, n)
            .orElseThrow(() -> new RegraException("Parcela não encontrada."));
        if (Banco.dia(pa, "pago_em") != null) {
            throw new RegraException("Esta parcela já foi recebida.");
        }
        if (Banco.dia(pa, "cancelada_em") != null) {
            throw new RegraException("Esta parcela foi cancelada.");
        }
        if ("dinheiro".equals(forma) && caixaId == null) {
            throw new RegraException("Abra o caixa para receber em dinheiro.");
        }
        Config cfg = config();
        BigDecimal valor = Banco.dec(pa, "valor");
        Regras.Encargos enc = Regras.encargos(valor, Banco.dia(pa, "venc"), ctx.hoje(), cfg.multa(), cfg.jurosMes());
        BigDecimal encargos = Boolean.FALSE.equals(p.cobrarEncargos()) ? BigDecimal.ZERO.setScale(2) : enc.total();
        BigDecimal total = r2(valor.add(encargos));
        long vendaId = Banco.id(pa, "venda_id");
        int qtd = Banco.inteiro(pa, "qtd");

        db.executar("update crediario_parcela set pago_em = ?, valor_pago = ?, forma = ? where crediario_id = ? and n = ?", ctx.hoje(), total, forma, credId, n);
        db.executar("update lancamento set status = 'pago', pago_em = ?, forma = ?, caixa_id = ? where crediario_id = ? and parcela = ? and status = 'pendente'",
            ctx.hoje(), forma, caixaId, credId, n);
        if (encargos.signum() > 0) {
            financeiro.inserir(new FinanceiroService.NovoLancamento(ctx.hoje(), "Crediário", vendaId, credId, null, "receita", Regras.CAT_ENCARGOS,
                "Juros e multa, parcela " + n + "/" + qtd + " da venda #" + vendaId, encargos, ctx.hoje(), true, forma, caixaId));
        }
        BigDecimal taxa = Regras.taxaCartao(forma, total);
        if (taxa.signum() > 0) {
            financeiro.inserir(new FinanceiroService.NovoLancamento(ctx.hoje(), "Crediário", null, null, null, "despesa", Regras.CAT_TAXAS,
                "Taxa " + Regras.FORMAS_PAGAMENTO.get(forma).toLowerCase() + ", parcela " + n + " da venda #" + vendaId, taxa, ctx.hoje(), true, forma, caixaId));
        }
        String nome = clientes.nomeCompleto(Banco.id(pa, "cliente_id"));
        auditoria.registrar(ctx.usuario(), "Parcela recebida", nome + ", parcela " + n + "/" + qtd + " da venda #" + vendaId + ": " + brl(total)
            + (encargos.signum() > 0 ? " (com " + brl(encargos) + " de multa e juros)" : "") + ", " + forma, null);
        return Map.of("total", total, "encargos", encargos, "nome", nome, "n", n, "qtd", qtd);
    }

    /** Devolução de venda no crediário: abate o valor das parcelas em aberto, da última para a primeira. Devolve o que sobrou. */
    BigDecimal abaterParcelas(long vendaId, BigDecimal valor, LocalDate hoje) {
        return abater("select id, valor, crediario_id, parcela from lancamento where venda_id = ? and tipo = 'receita' and status = 'pendente' "
            + "and crediario_id is not null order by venc desc, id desc for update", vendaId, valor, hoje);
    }

    /** Devolução de venda no cartão de crédito estornada no cartão: abate primeiro o que a maquininha ainda não pagou. */
    BigDecimal abaterRecebiveisCartao(long vendaId, BigDecimal valor, LocalDate hoje) {
        return abater("select id, valor, crediario_id, parcela from lancamento where venda_id = ? and tipo = 'receita' and status = 'pendente' "
            + "and crediario_id is null order by venc desc, id desc for update", vendaId, valor, hoje);
    }

    private BigDecimal abater(String sql, long vendaId, BigDecimal valor, LocalDate hoje) {
        BigDecimal resta = valor;
        List<Map<String, Object>> pendentes = new ArrayList<>(db.lista(sql, vendaId));
        for (Map<String, Object> l : pendentes) {
            if (resta.signum() <= 0) {
                break;
            }
            BigDecimal atual = Banco.dec(l, "valor");
            BigDecimal usado = Regras.min(atual, resta);
            BigDecimal novo = r2(atual.subtract(usado));
            resta = r2(resta.subtract(usado));
            db.executar("update lancamento set valor = ?, status = case when ? <= 0 then 'cancelado' else status end where id = ?", novo, novo, Banco.id(l, "id"));
            Long credId = Banco.id(l, "crediario_id");
            Long parcela = Banco.id(l, "parcela");
            if (credId != null && parcela != null) {
                db.executar("update crediario_parcela set valor = ?, cancelada_em = case when ? <= 0 then ? else cancelada_em end where crediario_id = ? and n = ?",
                    novo, novo, hoje, credId, parcela.intValue());
            }
        }
        return resta;
    }

    @Transactional
    public void salvarRegras(Pedidos.RegrasCrediario r, Contexto ctx) {
        if (r.maxParcelas() == null || r.maxParcelas() < 1 || r.maxParcelas() > 12) {
            throw new RegraException("O máximo de parcelas vai de 1 a 12.");
        }
        if (r.limitePadrao() == null || r.limitePadrao().signum() < 0) {
            throw new RegraException("Informe o limite padrão por cliente.");
        }
        if (r.multa() == null || r.multa().signum() < 0 || r.multa().compareTo(new BigDecimal("2")) > 0) {
            throw new RegraException("A multa por atraso pode ir de 0% a 2%.");
        }
        if (r.jurosMes() == null || r.jurosMes().signum() < 0 || r.jurosMes().compareTo(BigDecimal.TEN) > 0) {
            throw new RegraException("Os juros por atraso vão de 0% a 10% ao mês.");
        }
        if (r.primeiroVencDias() == null || r.primeiroVencDias() < 1 || r.primeiroVencDias() > 90) {
            throw new RegraException("O 1º vencimento fica entre 1 e 90 dias.");
        }
        db.executar("update configuracao set cred_max_parcelas = ?, cred_limite_padrao = ?, cred_multa_pct = ?, cred_juros_mes_pct = ?, cred_primeiro_venc_dias = ? where id = 1",
            r.maxParcelas(), r2(r.limitePadrao()), r.multa(), r.jurosMes(), r.primeiroVencDias());
        auditoria.registrar(ctx.usuario(), "Regras do crediário alteradas", "Até " + r.maxParcelas() + "x, limite padrão " + brl(r2(r.limitePadrao()))
            + ", multa " + r.multa().stripTrailingZeros().toPlainString() + "%, juros " + r.jurosMes().stripTrailingZeros().toPlainString() + "% ao mês", null);
    }
}
