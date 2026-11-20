package br.com.pocarsport.api.loja;

import static br.com.pocarsport.api.loja.Regras.brl;
import static br.com.pocarsport.api.loja.Regras.r2;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import br.com.pocarsport.api.auditoria.AuditoriaService;

/** Produtos, variações (tamanho x cor), códigos de barras e entrada de mercadoria. */
@Service
public class CatalogoService {

    static final String PRODUTOS_INICIAIS = "/produtos-iniciais.json";

    private final Banco db;
    private final AuditoriaService auditoria;
    private final ObjectMapper json;
    private final FinanceiroService financeiro;

    public CatalogoService(Banco db, AuditoriaService auditoria, ObjectMapper json, FinanceiroService financeiro) {
        this.db = db;
        this.auditoria = auditoria;
        this.json = json;
        this.financeiro = financeiro;
    }

    /** Próximo código de barras interno livre. Trava a linha da configuração para dois cadastros não pegarem o mesmo número. */
    String novoCodigoBarras() {
        long n = db.contar("select proximo_codigo_barras from configuracao where id = 1 for update");
        String codigo;
        do {
            codigo = Regras.codigoInterno(n++);
        } while (db.contar("select count(*) from variante where codigo_barras = ?", codigo) > 0);
        db.executar("update configuracao set proximo_codigo_barras = ? where id = 1", n);
        return codigo;
    }

    @Transactional
    public Map<String, Object> novoProduto(Pedidos.NovoProduto p, Contexto ctx) {
        String nome = limpo(p.nome());
        String categoria = limpo(p.categoria());
        if (nome.isEmpty()) {
            throw new RegraException("Informe o nome do produto.");
        }
        if (categoria.isEmpty()) {
            throw new RegraException("Informe a categoria.");
        }
        if (!Regras.positivo(p.preco())) {
            throw new RegraException("Informe o preço de venda.");
        }
        BigDecimal custo = p.custo() == null ? BigDecimal.ZERO : r2(p.custo());
        if (custo.signum() < 0) {
            throw new RegraException("O custo não pode ser negativo.");
        }
        List<String> tamanhos = p.tamanhos() == null ? List.of() : p.tamanhos().stream().map(String::trim).filter(t -> !t.isEmpty()).distinct().toList();
        Set<String> cores = new LinkedHashSet<>();
        if (p.cores() != null) {
            p.cores().stream().map(CatalogoService::limpo).filter(c -> !c.isEmpty()).forEach(cores::add);
        }
        if (tamanhos.isEmpty() || cores.isEmpty()) {
            throw new RegraException("Escolha pelo menos um tamanho e uma cor.");
        }
        int minimo = p.minimo() == null ? 0 : Math.max(0, p.minimo());

        String codigo = db.texto("select 'PS' || lpad(nextval('produto_seq')::text, 3, '0')");
        Map<String, String[]> variantes = new LinkedHashMap<>();
        for (String t : tamanhos) {
            for (String cor : cores) {
                if (variantes.put(Regras.sku(codigo, t, cor), new String[] {t, cor}) != null) {
                    throw new RegraException("A cor \"" + cor + "\" gera o mesmo código de outra cor parecida. Diferencie os nomes das cores.");
                }
            }
        }
        db.executar("insert into produto (codigo, nome, categoria, preco, custo, criado_em) values (?, ?, ?, ?, ?, ?)",
            codigo, nome, categoria, r2(p.preco()), custo, ctx.agora());
        for (Map.Entry<String, String[]> v : variantes.entrySet()) {
            String t = v.getValue()[0];
            db.executar("insert into variante (sku, produto_codigo, tamanho, cor, qtd, estoque_minimo, codigo_barras, ordem) values (?, ?, ?, ?, 0, ?, ?, ?)",
                v.getKey(), codigo, t, v.getValue()[1], minimo, novoCodigoBarras(), Regras.ordemTamanho(t));
        }
        auditoria.registrar(ctx.usuario(), "Produto cadastrado", codigo + " " + nome + ", " + brl(r2(p.preco())), null);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", codigo);
        r.put("codigos", variantes.size());
        return r;
    }

    /** Entrada de mercadoria: soma no estoque e, se pedido, cria a conta a pagar ao fornecedor. */
    @Transactional
    public void entrada(Pedidos.EntradaMercadoria e, Contexto ctx) {
        if (e.qtd() == null || e.qtd() <= 0) {
            throw new RegraException("Informe a quantidade que chegou.");
        }
        Map<String, Object> v = db.um("select v.sku, v.tamanho, v.cor, p.nome from variante v join produto p on p.codigo = v.produto_codigo where v.sku = ? for update of v", e.sku())
            .orElseThrow(() -> new RegraException("Variação de produto não encontrada."));
        String fornecedor = limpo(e.fornecedor());
        BigDecimal custo = e.custo() == null ? BigDecimal.ZERO : r2(e.custo());
        if (custo.signum() < 0) {
            throw new RegraException("O custo não pode ser negativo.");
        }
        boolean gerarConta = Boolean.TRUE.equals(e.gerarConta()) && custo.signum() > 0;
        if (gerarConta && e.venc() == null) {
            throw new RegraException("Informe o vencimento da conta a pagar.");
        }
        db.executar("update variante set qtd = qtd + ? where sku = ?", e.qtd(), e.sku());
        db.executar("insert into movimento_estoque (data, tipo, sku, qtd, origem, usuario) values (?, 'entrada', ?, ?, ?, ?)",
            ctx.agora(), e.sku(), e.qtd(), fornecedor.isEmpty() ? "Fornecedor" : fornecedor, ctx.nome());
        BigDecimal total = r2(custo.multiply(BigDecimal.valueOf(e.qtd())));
        String peca = Banco.txt(v, "nome") + " " + Banco.txt(v, "tamanho");
        if (gerarConta) {
            financeiro.inserir(new FinanceiroService.NovoLancamento(e.venc(), "Estoque", null, null, null, "despesa", Regras.CAT_FORNECEDORES,
                peca + " x" + e.qtd() + (fornecedor.isEmpty() ? "" : " (" + fornecedor + ")"), total, e.venc(), false, null, null));
        }
        auditoria.registrar(ctx.usuario(), "Entrada de mercadoria", e.qtd() + "x " + peca + " " + Banco.txt(v, "cor")
            + (fornecedor.isEmpty() ? "" : " de " + fornecedor) + (gerarConta ? ", conta a pagar de " + brl(total) : ""), null);
    }

    /** Movimenta o estoque de uma variação (venda, devolução, cancelamento). Saída não deixa o estoque negativo. */
    void movimentar(String sku, String tipo, int qtd, String origem, Contexto ctx) {
        if ("saida".equals(tipo)) {
            int alteradas = db.executar("update variante set qtd = qtd - ? where sku = ? and qtd >= ?", qtd, sku, qtd);
            if (alteradas == 0) {
                Map<String, Object> v = db.um("select p.nome, v.tamanho from variante v join produto p on p.codigo = v.produto_codigo where v.sku = ?", sku)
                    .orElseThrow(() -> new RegraException("Produto " + sku + " não encontrado."));
                throw new RegraException("Estoque insuficiente de " + Banco.txt(v, "nome") + " " + Banco.txt(v, "tamanho") + ".");
            }
        } else {
            db.executar("update variante set qtd = qtd + ? where sku = ?", qtd, sku);
        }
        db.executar("insert into movimento_estoque (data, tipo, sku, qtd, origem, usuario) values (?, ?, ?, ?, ?, ?)", ctx.agora(), tipo, sku, qtd, origem, ctx.nome());
    }

    /**
     * Carrega os produtos e o estoque iniciais da loja (src/main/resources/produtos-iniciais.json, gerado da planilha do PDV antigo
     * por "npm run importar-produtos"). Só roda com a loja sem produtos.
     */
    @Transactional
    public int importarIniciais(Contexto ctx) {
        if (db.contar("select count(*) from produto") > 0) {
            throw new IllegalStateException("A loja já tem produtos cadastrados.");
        }
        JsonNode produtos = lerProdutosIniciais();
        int pecas = 0;
        List<String> skus = new ArrayList<>();
        for (JsonNode p : produtos) {
            String codigo = p.path("id").asText();
            db.executar("insert into produto (codigo, nome, categoria, preco, custo, criado_em) values (?, ?, ?, ?, ?, ?)",
                codigo, p.path("nome").asText(), p.path("categoria").asText(), r2(p.path("preco").decimalValue()), r2(p.path("custo").decimalValue()), ctx.agora());
            int ordem = 0;
            for (JsonNode v : p.path("variantes")) {
                String sku = v.path("sku").asText();
                int qtd = v.path("qtd").asInt();
                db.executar("insert into variante (sku, produto_codigo, tamanho, cor, qtd, estoque_minimo, codigo_barras, ordem) values (?, ?, ?, ?, ?, ?, ?, ?)",
                    sku, codigo, v.path("tam").asText(), v.path("cor").asText(), qtd, v.path("min").asInt(0), novoCodigoBarras(), ordem++);
                if (qtd > 0) {
                    db.executar("insert into movimento_estoque (data, tipo, sku, qtd, origem, usuario) values (?, 'entrada', ?, ?, 'Estoque inicial', ?)",
                        ctx.agora(), sku, qtd, ctx.nome());
                }
                pecas += qtd;
                skus.add(sku);
            }
        }
        auditoria.registrar(ctx.usuario(), "Produtos iniciais carregados", produtos.size() + " produtos, " + skus.size() + " variações, " + pecas + " peças", null);
        return pecas;
    }

    private JsonNode lerProdutosIniciais() {
        try (InputStream in = getClass().getResourceAsStream(PRODUTOS_INICIAIS)) {
            if (in == null) {
                throw new IllegalStateException("Arquivo " + PRODUTOS_INICIAIS + " não encontrado.");
            }
            return json.readTree(in);
        } catch (IOException e) {
            throw new IllegalStateException("Não foi possível ler " + PRODUTOS_INICIAIS, e);
        }
    }

    static String limpo(String s) {
        return s == null ? "" : s.trim().replaceAll("\\s+", " ");
    }
}
