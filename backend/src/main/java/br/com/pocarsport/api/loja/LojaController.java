package br.com.pocarsport.api.loja;

import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.pocarsport.api.auditoria.AuditoriaService;
import br.com.pocarsport.api.auth.Acessos;
import br.com.pocarsport.api.auth.Usuario;
import br.com.pocarsport.api.auth.UsuarioAtual;
import br.com.pocarsport.api.web.SenhaConfirmacaoException;

/**
 * API da loja. Leitura: GET /api/loja (tudo que as telas mostram). Escrita: uma rota por operação;
 * as regras e os cálculos rodam no servidor, numa transação. Erro de regra: 422 {"erro": "mensagem"}.
 */
@RestController
@RequestMapping("/api")
public class LojaController {

    private final UsuarioAtual usuarioAtual;
    private final Acessos acessos;
    private final DespesaFixaService despesasFixas;
    private final Relogio relogio;
    private final PasswordEncoder senhas;
    private final AuditoriaService auditoria;
    private final LojaService loja;
    private final CatalogoService catalogo;
    private final ClienteService clientes;
    private final CaixaService caixa;
    private final VendaService vendas;
    private final CrediarioService crediario;
    private final FinanceiroService financeiro;
    private final FidelidadeService fidelidade;

    public LojaController(UsuarioAtual usuarioAtual, Acessos acessos, DespesaFixaService despesasFixas, Relogio relogio, PasswordEncoder senhas, AuditoriaService auditoria, LojaService loja,
                          CatalogoService catalogo, ClienteService clientes, CaixaService caixa, VendaService vendas, CrediarioService crediario,
                          FinanceiroService financeiro, FidelidadeService fidelidade) {
        this.usuarioAtual = usuarioAtual;
        this.acessos = acessos;
        this.despesasFixas = despesasFixas;
        this.relogio = relogio;
        this.senhas = senhas;
        this.auditoria = auditoria;
        this.loja = loja;
        this.catalogo = catalogo;
        this.clientes = clientes;
        this.caixa = caixa;
        this.vendas = vendas;
        this.crediario = crediario;
        this.financeiro = financeiro;
        this.fidelidade = fidelidade;
    }

    /** Usuário logado com acesso a pelo menos um dos menus informados (administrador passa sempre). */
    private Contexto ctx(Authentication auth, String... menus) {
        Usuario u = usuarioAtual.de(auth);
        acessos.exigir(u, menus);
        return relogio.contexto(u);
    }

    private static Map<String, Object> ok() {
        return Map.of("ok", true);
    }

    // ------------------------------------------------------------------ leitura e reinício

    @GetMapping(value = "/loja", produces = MediaType.APPLICATION_JSON_VALUE)
    public String loja(Authentication auth) {
        Usuario u = usuarioAtual.de(auth);
        despesasFixas.gerarContas(relogio.contexto(u).hoje()); // contas do mês das despesas fixas, se ainda não existem
        return loja.fotografia();
    }

    @PostMapping("/loja/reiniciar")
    public Map<String, Object> reiniciar(@RequestBody Pedidos.Reinicio p, Authentication auth) {
        Usuario u = usuarioAtual.de(auth);
        acessos.exigirAdmin(u);
        if (p.senhaConfirmacao() == null || !senhas.matches(p.senhaConfirmacao(), u.senhaHash())) {
            throw new SenhaConfirmacaoException();
        }
        loja.reiniciar(relogio.contexto(u));
        return ok();
    }

    /** Ações feitas só na tela (PDF do relatório, PDF de etiquetas) que entram na auditoria. */
    @PostMapping("/loja/registros")
    public Map<String, Object> registrarTela(@RequestBody Pedidos.RegistroTela p, Authentication auth) {
        Usuario u = usuarioAtual.de(auth);
        String acao = CatalogoService.limpo(p.acao());
        if (!acao.equals("Relatório financeiro exportado") && !acao.equals("Etiquetas geradas")) {
            throw new RegraException("Ação desconhecida.");
        }
        acessos.exigir(u, acao.startsWith("Relatório") ? "financeiro" : "estoque");
        auditoria.registrar(u, acao, p.detalhe(), null);
        return ok();
    }

    // ------------------------------------------------------------------ produtos e estoque

    @PostMapping("/produtos")
    public Map<String, Object> novoProduto(@RequestBody Pedidos.NovoProduto p, Authentication auth) {
        return catalogo.novoProduto(p, ctx(auth, "estoque"));
    }

    @PostMapping("/estoque/entradas")
    public Map<String, Object> entrada(@RequestBody Pedidos.EntradaMercadoria p, Authentication auth) {
        catalogo.entrada(p, ctx(auth, "estoque"));
        return ok();
    }

    // ------------------------------------------------------------------ clientes

    @PostMapping("/clientes")
    public Map<String, Object> novoCliente(@RequestBody Pedidos.Cliente p, Authentication auth) {
        return Map.of("id", clientes.salvar(null, p, ctx(auth, "clientes", "pdv")));
    }

    @PutMapping("/clientes/{id}")
    public Map<String, Object> editarCliente(@PathVariable long id, @RequestBody Pedidos.Cliente p, Authentication auth) {
        return Map.of("id", clientes.salvar(id, p, ctx(auth, "clientes")));
    }

    // ------------------------------------------------------------------ caixa

    @PostMapping("/caixa/abrir")
    public Map<String, Object> abrirCaixa(@RequestBody Pedidos.AbrirCaixa p, Authentication auth) {
        return Map.of("id", caixa.abrir(p, ctx(auth, "caixa", "pdv")));
    }

    @PostMapping("/caixa/movimentos")
    public Map<String, Object> movimentoCaixa(@RequestBody Pedidos.MovimentoCaixa p, Authentication auth) {
        caixa.movimentar(p, ctx(auth, "caixa"));
        return ok();
    }

    @PostMapping("/caixa/fechar")
    public Map<String, Object> fecharCaixa(@RequestBody Pedidos.FecharCaixa p, Authentication auth) {
        caixa.fechar(p, ctx(auth, "caixa"));
        return ok();
    }

    // ------------------------------------------------------------------ vendas

    @PostMapping("/vendas")
    public Map<String, Object> vender(@RequestBody Pedidos.Venda p, Authentication auth) {
        return vendas.registrar(p, ctx(auth, "pdv"));
    }

    @PostMapping("/vendas/{id}/devolucoes")
    public Map<String, Object> devolver(@PathVariable long id, @RequestBody Pedidos.Devolucao p, Authentication auth) {
        return vendas.devolver(id, p, ctx(auth, "caixa"));
    }

    @PostMapping("/vendas/{id}/cancelamento")
    public Map<String, Object> cancelar(@PathVariable long id, @RequestBody Pedidos.Cancelamento p, Authentication auth) {
        return vendas.cancelar(id, p, ctx(auth, "caixa"));
    }

    // ------------------------------------------------------------------ crediário e financeiro

    @PostMapping("/crediarios/{id}/parcelas/{n}/recebimento")
    public Map<String, Object> receberParcela(@PathVariable long id, @PathVariable int n, @RequestBody Pedidos.RecebimentoParcela p, Authentication auth) {
        return crediario.receber(id, n, p, ctx(auth, "crediario", "financeiro"));
    }

    @PostMapping("/lancamentos")
    public Map<String, Object> lancamento(@RequestBody Pedidos.Lancamento p, Authentication auth) {
        return Map.of("id", financeiro.lancamentoManual(p, ctx(auth, "financeiro")));
    }

    @PostMapping("/lancamentos/{id}/baixa")
    public Map<String, Object> baixar(@PathVariable long id, Authentication auth) {
        financeiro.baixar(id, ctx(auth, "financeiro"));
        return ok();
    }

    @PostMapping("/fechamentos/{mes}")
    public Map<String, Object> fecharMes(@PathVariable String mes, @RequestBody Pedidos.Fechamento p, Authentication auth) {
        financeiro.fecharMes(mes, p.obs(), ctx(auth, "financeiro"));
        return ok();
    }

    @PutMapping("/metas/{mes}")
    public Map<String, Object> meta(@PathVariable String mes, @RequestBody Pedidos.Meta p, Authentication auth) {
        financeiro.definirMeta(mes, p.valor(), ctx(auth, "metas"));
        return ok();
    }

    // ------------------------------------------------------------------ despesas fixas

    @PostMapping("/despesas-fixas")
    public Map<String, Object> novaDespesaFixa(@RequestBody Pedidos.DespesaFixa p, Authentication auth) {
        return Map.of("id", despesasFixas.salvar(null, p, ctx(auth, "financeiro")));
    }

    @PutMapping("/despesas-fixas/{id}")
    public Map<String, Object> editarDespesaFixa(@PathVariable long id, @RequestBody Pedidos.DespesaFixa p, Authentication auth) {
        return Map.of("id", despesasFixas.salvar(id, p, ctx(auth, "financeiro")));
    }

    // ------------------------------------------------------------------ configurações

    @PutMapping("/config/fidelidade")
    public Map<String, Object> regrasFidelidade(@RequestBody Pedidos.RegrasFidelidade p, Authentication auth) {
        fidelidade.salvarRegras(p, ctx(auth, "fidelidade"));
        return ok();
    }

    @PutMapping("/config/crediario")
    public Map<String, Object> regrasCrediario(@RequestBody Pedidos.RegrasCrediario p, Authentication auth) {
        crediario.salvarRegras(p, ctx(auth, "crediario"));
        return ok();
    }

    @PutMapping("/config/etiquetas")
    public Map<String, Object> etiquetas(@RequestBody Pedidos.ConfigEtiquetas p, Authentication auth) {
        ctx(auth, "estoque");
        loja.salvarEtiquetas(p);
        return ok();
    }
}
