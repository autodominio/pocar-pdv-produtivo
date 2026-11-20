package br.com.pocarsport.api.loja;

import static br.com.pocarsport.api.loja.Regras.brl;
import static br.com.pocarsport.api.loja.Regras.r2;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.pocarsport.api.auditoria.AuditoriaService;

/**
 * Vendas: registro no PDV (com troca, vale, cashback e crediário), devolução com estorno e cancelamento.
 * Cada operação é uma transação só: estoque, financeiro, crediário, fidelidade e auditoria gravam juntos ou nada grava.
 */
@Service
public class VendaService {

    private final Banco db;
    private final AuditoriaService auditoria;
    private final CatalogoService catalogo;
    private final FinanceiroService financeiro;
    private final CaixaService caixa;
    private final FidelidadeService fidelidade;
    private final CrediarioService crediario;
    private final ClienteService clientes;

    public VendaService(Banco db, AuditoriaService auditoria, CatalogoService catalogo, FinanceiroService financeiro, CaixaService caixa,
                        FidelidadeService fidelidade, CrediarioService crediario, ClienteService clientes) {
        this.db = db;
        this.auditoria = auditoria;
        this.catalogo = catalogo;
        this.financeiro = financeiro;
        this.caixa = caixa;
        this.fidelidade = fidelidade;
        this.crediario = crediario;
        this.clientes = clientes;
    }

    record Item(String sku, String nome, String tam, String cor, BigDecimal preco, BigDecimal custo, int qtd) {
        BigDecimal total() {
            return r2(preco.multiply(BigDecimal.valueOf(qtd)));
        }

        Map<String, Object> json() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sku", sku);
            m.put("nome", nome);
            m.put("tam", tam);
            m.put("cor", cor);
            m.put("preco", preco);
            m.put("qtd", qtd);
            return m;
        }
    }

    /** Valores de uma devolução: bruto (preço cheio), líquido (sem o desconto da venda) e valor (o que o cliente pagou de fato). */
    record Previa(List<Item> itens, BigDecimal bruto, BigDecimal liquido, BigDecimal valor) {
        int pecas() {
            return itens.stream().mapToInt(Item::qtd).sum();
        }

        String descricao() {
            return itens.stream().map(i -> i.qtd() + "x " + i.nome() + " " + i.tam()).collect(Collectors.joining(", "));
        }
    }

    // ================================================================== venda

    @Transactional
    public Map<String, Object> registrar(Pedidos.Venda p, Contexto ctx) {
        long caixaId = caixa.abertoTravado().orElseThrow(() -> new RegraException("Abra o caixa para começar a vender."));
        List<Item> itens = carrinho(p.itens());
        Long clienteId = p.clienteId();
        if (clienteId != null && db.contar("select count(*) from cliente where id = ?", clienteId) == 0) {
            throw new RegraException("Cliente não encontrado.");
        }

        // Troca: as peças antigas voltam e o valor pago por elas vira crédito nesta venda.
        Pedidos.TrocaVenda troca = p.troca();
        Map<String, Object> vendaTroca = null;
        Previa previaTroca = null;
        if (troca != null) {
            vendaTroca = vendaTravada(troca.vendaId());
            if ("cancelada".equals(Banco.txt(vendaTroca, "status"))) {
                throw new RegraException("A venda da troca foi cancelada.");
            }
            previaTroca = previa(vendaTroca, troca.qtds());
            if (previaTroca.itens().isEmpty()) {
                throw new RegraException("Escolha as peças que estão voltando na troca.");
            }
            if (!List.of("vale", "dinheiro", "pix").contains(troca.sobraDestino())) {
                throw new RegraException("Escolha o que fazer com a sobra da troca.");
            }
            if (CatalogoService.limpo(troca.motivo()).isEmpty()) {
                throw new RegraException("Informe o motivo da troca.");
            }
        }

        // Estoque conferido antes de gravar (numa troca, a peça que volta já conta). O update condicional em movimentar
        // continua protegendo duas vendas simultâneas da última peça.
        for (Item i : itens) {
            final Previa pt = previaTroca;
            int volta = pt == null ? 0 : pt.itens().stream().filter(x -> x.sku().equals(i.sku())).mapToInt(Item::qtd).sum();
            if (db.contar("select qtd from variante where sku = ?", i.sku()) + volta < i.qtd()) {
                throw new RegraException("Estoque insuficiente de " + i.nome() + " " + i.tam() + ".");
            }
        }

        BigDecimal subtotal = r2(itens.stream().map(Item::total).reduce(BigDecimal.ZERO, BigDecimal::add));
        BigDecimal desconto = Regras.desconto(subtotal, p.desconto(), !"R$".equals(p.descontoTipo()));

        List<Long> valesIds = p.valesIds() == null ? List.of() : p.valesIds().stream().distinct().toList();
        boolean usarCashback = Boolean.TRUE.equals(p.usarCashback());
        BigDecimal valesSelecionados = BigDecimal.ZERO;
        BigDecimal cashDisponivel = BigDecimal.ZERO;
        if (clienteId == null) {
            if (!valesIds.isEmpty() || usarCashback) {
                throw new RegraException("Identifique o cliente para usar vale ou cashback.");
            }
        } else {
            db.um("select id from cliente where id = ? for update", clienteId); // benefícios do cliente não são usados em duas vendas ao mesmo tempo
            Map<Long, BigDecimal> validos = fidelidade.valesValidos(clienteId, ctx.hoje());
            for (Long id : valesIds) {
                if (!validos.containsKey(id)) {
                    throw new RegraException("Um dos vales escolhidos não está mais disponível. Atualize a tela.");
                }
                valesSelecionados = valesSelecionados.add(validos.get(id));
            }
            cashDisponivel = fidelidade.saldoCashback(clienteId, ctx.hoje());
        }

        Regras.Totais t = Regras.totais(subtotal, desconto, valesSelecionados, cashDisponivel, usarCashback,
            previaTroca == null ? null : previaTroca.valor());
        if (previaTroca != null && t.sobraTroca().signum() > 0 && "vale".equals(troca.sobraDestino()) && clienteId == null) {
            throw new RegraException("Identifique o cliente para gerar o vale-troca da sobra.");
        }

        String pagamento = p.pagamento();
        if (!Regras.FORMAS_PAGAMENTO.containsKey(pagamento)) {
            throw new RegraException("Escolha a forma de pagamento.");
        }
        int parcelas = 1;
        List<Regras.Parcela> plano = null;
        BigDecimal entrada = BigDecimal.ZERO.setScale(2);
        String entradaForma = null;
        if ("credito".equals(pagamento)) {
            parcelas = p.parcelas() == null ? 1 : p.parcelas();
            if (parcelas < 1 || parcelas > Regras.MAX_PARCELAS_CARTAO) {
                throw new RegraException("O cartão de crédito vai de 1 a " + Regras.MAX_PARCELAS_CARTAO + " parcelas.");
            }
        } else if ("crediario".equals(pagamento)) {
            plano = crediario.validarVenda(clienteId, t.total(), p.crediario(), ctx.hoje());
            parcelas = plano.size();
            entrada = p.crediario().entrada() == null ? entrada : r2(p.crediario().entrada());
            entradaForma = entrada.signum() > 0 ? p.crediario().entradaForma() : null;
        } else if ("dinheiro".equals(pagamento) && (p.recebido() == null || p.recebido().compareTo(t.total()) < 0)) {
            throw new RegraException("Informe o valor recebido em dinheiro.");
        }

        // ---------------------------------------------------------- grava
        Long devTrocaId = null;
        if (previaTroca != null) {
            devTrocaId = gravarDevolucao(vendaTroca, previaTroca, "troca", null, CatalogoService.limpo(troca.motivo()), caixaId, ctx);
        }
        long vendaId = db.inserir("insert into venda (data, vendedor, cliente_id, subtotal, desconto, vale_usado, cashback_usado, credito_troca, total, pagamento, "
                + "parcelas, entrada, entrada_forma, caixa_id, registrado_por, troca_de) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ctx.agora(), ctx.nome(), clienteId, t.subtotal(), t.desconto(), t.vale(), t.cashback(), t.troca(), t.total(), pagamento,
            parcelas, entrada, entradaForma, caixaId, ctx.nome(), troca == null ? null : troca.vendaId());
        for (Item i : itens) {
            db.executar("insert into venda_item (venda_id, sku, nome, tamanho, cor, preco, custo, qtd) values (?, ?, ?, ?, ?, ?, ?, ?)",
                vendaId, i.sku(), i.nome(), i.tam(), i.cor(), i.preco(), i.custo(), i.qtd());
            catalogo.movimentar(i.sku(), "saida", i.qtd(), "Venda #" + vendaId, ctx);
        }
        int lancs = financeiro.lancamentosDaVenda(vendaId, t.total(), pagamento, parcelas, caixaId, ctx.hoje());
        Map<String, Object> cred = null;
        if (plano != null) {
            long[] criado = crediario.criar(vendaId, clienteId, t.total(), entrada, entradaForma, plano, caixaId, ctx.hoje());
            lancs += (int) criado[1];
            cred = new LinkedHashMap<>();
            cred.put("id", criado[0]);
            cred.put("entrada", entrada);
            cred.put("parcelas", plano.stream().map(x -> Map.of("n", x.n(), "valor", x.valor(), "venc", x.venc())).toList());
        }
        FidelidadeService.Ganhos ganhos = fidelidade.aplicar(vendaId, clienteId, valesIds, t.cashback(), t.total(), ctx.hoje());

        Map<String, Object> sobra = null;
        if (previaTroca != null && t.sobraTroca().signum() > 0) {
            sobra = new LinkedHashMap<>();
            sobra.put("valor", t.sobraTroca());
            if ("vale".equals(troca.sobraDestino())) {
                fidelidade.valeTroca(clienteId, t.sobraTroca(), vendaId, ctx.hoje());
                sobra.put("vale", true);
            } else {
                financeiro.estorno(troca.vendaId(), t.sobraTroca(), troca.sobraDestino(),
                    "Sobra da troca da venda #" + troca.vendaId() + " (" + Regras.FORMAS_ESTORNO.get(troca.sobraDestino()) + ")", caixaId, ctx.hoje());
                db.executar("update devolucao set sobra_estornada = ? where id = ?", t.sobraTroca(), devTrocaId);
                sobra.put("forma", troca.sobraDestino());
            }
        }

        String nomeCliente = clientes.nomeCompleto(clienteId);
        if (previaTroca != null) {
            auditoria.registrar(ctx.usuario(), "Troca", "Venda #" + troca.vendaId() + ": devolveu " + previaTroca.descricao() + " (crédito de " + brl(previaTroca.valor())
                + "). Nova venda #" + vendaId + (sobra == null ? "" : ", sobra de " + brl(t.sobraTroca())
                + (sobra.containsKey("vale") ? " em vale-troca" : " devolvida em " + Regras.FORMAS_ESTORNO.get(troca.sobraDestino()).toLowerCase()))
                + ". Motivo: " + CatalogoService.limpo(troca.motivo()), null);
        }
        int pecas = itens.stream().mapToInt(Item::qtd).sum();
        auditoria.registrar(ctx.usuario(), "Venda registrada", "Venda #" + vendaId + ": " + brl(t.total()) + " (" + pagamento + (parcelas > 1 ? " " + parcelas + "x" : "")
            + "), " + pecas + " peças" + (t.desconto().signum() > 0 ? ", desconto de " + brl(t.desconto()) : "")
            + (nomeCliente.isEmpty() ? "" : ", cliente " + nomeCliente), null);

        Map<String, Object> recibo = new LinkedHashMap<>();
        recibo.put("id", vendaId);
        recibo.put("itens", itens.stream().map(Item::json).toList());
        recibo.put("subtotal", t.subtotal());
        recibo.put("desconto", t.desconto());
        recibo.put("valeUsado", t.vale());
        recibo.put("cashbackUsado", t.cashback());
        recibo.put("creditoTroca", t.troca());
        recibo.put("total", t.total());
        recibo.put("pagamento", pagamento);
        recibo.put("parcelas", parcelas);
        recibo.put("trocaDe", troca == null ? null : troca.vendaId());
        recibo.put("troco", "dinheiro".equals(pagamento) ? r2(p.recebido().subtract(t.total())) : BigDecimal.ZERO);
        recibo.put("lancs", lancs);
        recibo.put("clienteNome", nomeCliente);
        Map<String, Object> g = new LinkedHashMap<>();
        g.put("cashback", ganhos.cashback());
        g.put("cashValidade", ganhos.cashValidade());
        g.put("vale", ganhos.vale() == null ? null : Map.of("valor", ganhos.vale(), "validade", ganhos.valeValidade()));
        recibo.put("ganhos", g);
        recibo.put("cred", cred);
        recibo.put("sobra", sobra);
        return recibo;
    }

    /** Itens do carrinho com nome, preço e custo atuais do cadastro (o preço vem do servidor, não da tela). */
    private List<Item> carrinho(List<Pedidos.ItemVenda> pedidos) {
        if (pedidos == null || pedidos.isEmpty()) {
            throw new RegraException("O carrinho está vazio.");
        }
        Map<String, Integer> qtds = new LinkedHashMap<>();
        for (Pedidos.ItemVenda i : pedidos) {
            if (i.sku() == null || i.qtd() == null || i.qtd() <= 0) {
                throw new RegraException("Item inválido no carrinho.");
            }
            qtds.merge(i.sku(), i.qtd(), Integer::sum);
        }
        List<Item> out = new ArrayList<>();
        for (Map.Entry<String, Integer> e : qtds.entrySet()) {
            Map<String, Object> v = db.um("select v.sku, v.tamanho, v.cor, v.qtd, p.nome, p.preco, p.custo from variante v join produto p on p.codigo = v.produto_codigo where v.sku = ?", e.getKey())
                .orElseThrow(() -> new RegraException("Produto " + e.getKey() + " não encontrado."));
            out.add(new Item(e.getKey(), Banco.txt(v, "nome"), Banco.txt(v, "tamanho"), Banco.txt(v, "cor"), Banco.dec(v, "preco"), Banco.dec(v, "custo"), e.getValue()));
        }
        return out;
    }

    // ================================================================== devolução

    private Map<String, Object> vendaTravada(Long id) {
        if (id == null) {
            throw new RegraException("Venda não encontrada.");
        }
        return db.um("select * from venda where id = ? for update", id).orElseThrow(() -> new RegraException("Venda #" + id + " não encontrada."));
    }

    /** Peças que ainda podem voltar (vendidas menos já devolvidas), limitadas ao que foi pedido. */
    Previa previa(Map<String, Object> venda, Map<String, Integer> qtds) {
        long vendaId = Banco.id(venda, "id");
        Map<String, Integer> pedido = qtds == null ? Map.of() : qtds;
        List<Item> itens = new ArrayList<>();
        BigDecimal bruto = BigDecimal.ZERO;
        for (Map<String, Object> i : db.lista("select i.sku, i.nome, i.tamanho, i.cor, i.preco, i.custo, i.qtd - coalesce((select sum(di.qtd) from devolucao_item di "
            + "join devolucao d on d.id = di.devolucao_id where d.venda_id = i.venda_id and di.sku = i.sku), 0) as disponivel from venda_item i where i.venda_id = ? order by i.id", vendaId)) {
            int quer = pedido.getOrDefault(Banco.txt(i, "sku"), 0);
            int qtd = Math.min(quer, Banco.inteiro(i, "disponivel"));
            if (qtd > 0) {
                Item item = new Item(Banco.txt(i, "sku"), Banco.txt(i, "nome"), Banco.txt(i, "tamanho"), Banco.txt(i, "cor"), Banco.dec(i, "preco"), Banco.dec(i, "custo"), qtd);
                itens.add(item);
                bruto = bruto.add(item.total());
            }
        }
        BigDecimal subtotal = Banco.dec(venda, "subtotal");
        return new Previa(itens, r2(bruto), Regras.valorLiquido(bruto, subtotal, Banco.dec(venda, "desconto")),
            Regras.valorPago(bruto, subtotal, Banco.dec(venda, "total")));
    }

    /** Peças voltam ao estoque e a devolução fica registrada. */
    private long gravarDevolucao(Map<String, Object> venda, Previa pv, String destino, String forma, String motivo, Long caixaId, Contexto ctx) {
        long vendaId = Banco.id(venda, "id");
        long devId = db.inserir("insert into devolucao (venda_id, data, valor_bruto, valor_liquido, valor, destino, forma, motivo, usuario, caixa_id) "
            + "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", vendaId, ctx.agora(), pv.bruto(), pv.liquido(), pv.valor(), destino, forma, motivo, ctx.nome(), caixaId);
        for (Item i : pv.itens()) {
            db.executar("insert into devolucao_item (devolucao_id, sku, nome, tamanho, cor, preco, custo, qtd) values (?, ?, ?, ?, ?, ?, ?, ?)",
                devId, i.sku(), i.nome(), i.tam(), i.cor(), i.preco(), i.custo(), i.qtd());
            catalogo.movimentar(i.sku(), "entrada", i.qtd(), "Devolução da venda #" + vendaId, ctx);
        }
        return devId;
    }

    /**
     * Devolução com dinheiro de volta. Venda no crediário abate primeiro as parcelas em aberto; no cartão de crédito com estorno no cartão,
     * abate primeiro o que a maquininha ainda não pagou. O resto sai como estorno na forma escolhida.
     */
    @Transactional
    public Map<String, Object> devolver(long vendaId, Pedidos.Devolucao p, Contexto ctx) {
        Long caixaId = caixa.abertoTravado().orElse(null); // sempre o caixa antes da venda: mesma ordem de travas em todas as operações
        Map<String, Object> venda = vendaTravada(vendaId);
        if ("cancelada".equals(Banco.txt(venda, "status"))) {
            throw new RegraException("Esta venda foi cancelada.");
        }
        String forma = p.forma();
        if (!Regras.FORMAS_ESTORNO.containsKey(forma)) {
            throw new RegraException("Escolha como o dinheiro volta para o cliente.");
        }
        String motivo = CatalogoService.limpo(p.motivo());
        if (motivo.isEmpty()) {
            throw new RegraException("Descreva o motivo.");
        }
        Previa pv = previa(venda, p.qtds());
        if (pv.itens().isEmpty()) {
            throw new RegraException("Escolha as peças que estão voltando.");
        }
        String pagamento = Banco.txt(venda, "pagamento");
        if ("dinheiro".equals(forma) && caixaId == null && !"crediario".equals(pagamento)) {
            throw new RegraException("Abra o caixa para devolver em dinheiro.");
        }
        long devId = gravarDevolucao(venda, pv, "estorno", forma, motivo, caixaId, ctx);
        BigDecimal resta = pv.valor();
        if ("crediario".equals(pagamento)) {
            resta = crediario.abaterParcelas(vendaId, resta, ctx.hoje());
        } else if ("credito".equals(pagamento) && "cartao".equals(forma)) {
            resta = crediario.abaterRecebiveisCartao(vendaId, resta, ctx.hoje());
        }
        BigDecimal abatido = r2(pv.valor().subtract(resta));
        if (resta.signum() > 0) {
            financeiro.estorno(vendaId, resta, forma, "Devolução da venda #" + vendaId + " (" + Regras.FORMAS_ESTORNO.get(forma) + ")", caixaId, ctx.hoje());
        }
        db.executar("update devolucao set abatido = ?, estornado = ? where id = ?", abatido, resta, devId);
        fidelidade.estornarProporcional(vendaId, Banco.id(venda, "cliente_id"), pv.valor(), Banco.dec(venda, "total"));

        List<String> comoVolta = new ArrayList<>();
        if (abatido.signum() > 0) {
            comoVolta.add(brl(abatido) + " abatidos das parcelas/recebíveis");
        }
        if (resta.signum() > 0) {
            comoVolta.add(brl(resta) + " devolvidos (" + Regras.FORMAS_ESTORNO.get(forma) + ")");
        }
        String resumo = String.join(" e ", comoVolta);
        auditoria.registrar(ctx.usuario(), "Devolução", "Venda #" + vendaId + ": " + pv.descricao() + ". " + resumo + ". Motivo: " + motivo, null);
        Map<String, Object> r = new HashMap<>();
        r.put("abatido", abatido);
        r.put("estornado", resta);
        r.put("resumo", resumo);
        return r;
    }

    // ================================================================== cancelamento

    /**
     * Cancela a venda inteira: estoque volta, recebíveis em aberto são cancelados, o que já foi recebido é estornado
     * e vales/cashback usados voltam para o cliente; os benefícios que a venda gerou são retirados.
     */
    @Transactional
    public Map<String, Object> cancelar(long vendaId, Pedidos.Cancelamento p, Contexto ctx) {
        Long caixaId = caixa.abertoTravado().orElse(null); // caixa antes da venda, como nas outras operações
        Map<String, Object> venda = vendaTravada(vendaId);
        if ("cancelada".equals(Banco.txt(venda, "status"))) {
            throw new RegraException("Esta venda já foi cancelada.");
        }
        if (db.contar("select count(*) from devolucao where venda_id = ?", vendaId) > 0) {
            throw new RegraException("Esta venda já teve devolução. Use \"Devolver ou trocar\" para as peças restantes.");
        }
        String motivo = CatalogoService.limpo(p.motivo());
        if (motivo.length() < 3) {
            throw new RegraException("Informe o motivo do cancelamento.");
        }
        BigDecimal jaRecebido = db.soma("select sum(valor) from lancamento where venda_id = ? and tipo = 'receita' and status = 'pago'", vendaId);
        BigDecimal pendente = db.soma("select sum(valor) from lancamento where venda_id = ? and tipo = 'receita' and status = 'pendente'", vendaId);
        String forma = jaRecebido.signum() > 0 ? p.forma() : null;
        if (forma != null && !Regras.FORMAS_ESTORNO.containsKey(forma)) {
            throw new RegraException("Escolha como o dinheiro volta para o cliente.");
        }
        if ("dinheiro".equals(forma) && caixaId == null) {
            throw new RegraException("Abra o caixa para devolver em dinheiro.");
        }

        for (Map<String, Object> i : db.lista("select sku, qtd from venda_item where venda_id = ? order by id", vendaId)) {
            catalogo.movimentar(Banco.txt(i, "sku"), "entrada", Banco.inteiro(i, "qtd"), "Cancelamento da venda #" + vendaId, ctx);
        }
        db.executar("update lancamento set status = 'cancelado' where venda_id = ? and tipo = 'receita' and status = 'pendente'", vendaId);
        db.executar("update crediario_parcela set cancelada_em = ? where pago_em is null and cancelada_em is null "
            + "and crediario_id in (select id from crediario where venda_id = ?)", ctx.hoje(), vendaId);
        if (jaRecebido.signum() > 0) {
            financeiro.estorno(vendaId, jaRecebido, forma, "Cancelamento da venda #" + vendaId + " (" + Regras.FORMAS_ESTORNO.get(forma) + ")", caixaId, ctx.hoje());
        }
        BigDecimal total = Banco.dec(venda, "total");
        fidelidade.desfazer(vendaId, Banco.id(venda, "cliente_id"), Banco.dec(venda, "cashback_usado"), total, ctx.hoje());
        db.executar("update venda set status = 'cancelada', cancelada_em = ?, cancelada_por = ?, motivo_cancelamento = ?, estorno_valor = ?, estorno_forma = ? where id = ?",
            ctx.agora(), ctx.nome(), FinanceiroService.cortar(motivo, 300), jaRecebido, forma, vendaId);
        auditoria.registrar(ctx.usuario(), "Venda cancelada", "Venda #" + vendaId + " de " + brl(total)
            + (jaRecebido.signum() > 0 ? ", estorno de " + brl(jaRecebido) + " (" + Regras.FORMAS_ESTORNO.get(forma) + ")" : "")
            + (pendente.signum() > 0 ? ", " + brl(pendente) + " a receber cancelados" : "") + ". Motivo: " + motivo, null);
        Map<String, Object> r = new HashMap<>();
        r.put("estornado", jaRecebido);
        r.put("pendenteCancelado", pendente);
        return r;
    }
}
