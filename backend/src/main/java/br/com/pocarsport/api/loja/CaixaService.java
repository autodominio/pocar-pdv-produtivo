package br.com.pocarsport.api.loja;

import static br.com.pocarsport.api.loja.Regras.brl;
import static br.com.pocarsport.api.loja.Regras.r2;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.pocarsport.api.auditoria.AuditoriaService;

/** Abertura, dinheiro adicionado/removido (suprimento/sangria) e fechamento com conferência da gaveta. */
@Service
public class CaixaService {

    private final Banco db;
    private final AuditoriaService auditoria;

    public CaixaService(Banco db, AuditoriaService auditoria) {
        this.db = db;
        this.auditoria = auditoria;
    }

    /** Caixa aberto, travado até o fim da transação (para venda, devolução e fechamento não se cruzarem). */
    Optional<Long> abertoTravado() {
        return db.um("select id from caixa where fechado_em is null for update").map(c -> Banco.id(c, "id"));
    }

    long abertoObrigatorio() {
        return abertoTravado().orElseThrow(() -> new RegraException("Abra o caixa para continuar."));
    }

    /** Dinheiro que deve estar na gaveta: troco inicial + entradas em dinheiro - saídas em dinheiro + adicionado - removido. */
    BigDecimal esperado(long caixaId) {
        Map<String, Object> c = db.um("select valor_inicial from caixa where id = ?", caixaId).orElseThrow();
        BigDecimal entrou = db.soma("select sum(valor) from lancamento where caixa_id = ? and status = 'pago' and tipo = 'receita' and forma = 'dinheiro'", caixaId);
        BigDecimal saiu = db.soma("select sum(valor) from lancamento where caixa_id = ? and status = 'pago' and tipo = 'despesa' and forma = 'dinheiro'", caixaId);
        BigDecimal adicionado = db.soma("select sum(valor) from caixa_movimento where caixa_id = ? and tipo = 'suprimento'", caixaId);
        BigDecimal removido = db.soma("select sum(valor) from caixa_movimento where caixa_id = ? and tipo = 'sangria'", caixaId);
        return r2(Banco.dec(c, "valor_inicial").add(entrou).subtract(saiu).add(adicionado).subtract(removido));
    }

    @Transactional
    public long abrir(Pedidos.AbrirCaixa p, Contexto ctx) {
        if (abertoTravado().isPresent()) {
            throw new RegraException("Já existe um caixa aberto.");
        }
        if (p.valor() == null || p.valor().signum() < 0) {
            throw new RegraException("Informe o troco inicial (pode ser zero).");
        }
        String obs = CatalogoService.limpo(p.obs());
        long id = db.inserir("insert into caixa (aberto_em, aberto_por, valor_inicial, obs_abertura) values (?, ?, ?, ?)", ctx.agora(), ctx.nome(), r2(p.valor()), obs);
        auditoria.registrar(ctx.usuario(), "Caixa aberto", "Troco inicial de " + brl(r2(p.valor())) + (obs.isEmpty() ? "" : ". " + obs), null);
        return id;
    }

    @Transactional
    public void movimentar(Pedidos.MovimentoCaixa p, Contexto ctx) {
        long caixaId = abertoTravado().orElseThrow(() -> new RegraException("Abra o caixa primeiro."));
        boolean remover = "sangria".equals(p.tipo());
        if (!remover && !"suprimento".equals(p.tipo())) {
            throw new RegraException("Escolha se é para adicionar ou remover dinheiro.");
        }
        if (!Regras.positivo(p.valor())) {
            throw new RegraException("Informe o valor.");
        }
        String motivo = CatalogoService.limpo(p.motivo());
        if (motivo.isEmpty()) {
            throw new RegraException("Informe o motivo.");
        }
        BigDecimal valor = r2(p.valor());
        BigDecimal naGaveta = esperado(caixaId);
        if (remover && valor.compareTo(naGaveta) > 0) {
            throw new RegraException("A gaveta tem " + brl(naGaveta) + " em dinheiro.");
        }
        db.executar("insert into caixa_movimento (caixa_id, quando, tipo, valor, motivo, usuario) values (?, ?, ?, ?, ?, ?)",
            caixaId, ctx.agora(), p.tipo(), valor, motivo, ctx.nome());
        auditoria.registrar(ctx.usuario(), remover ? "Removido do caixa" : "Adicionado ao caixa", brl(valor) + ". " + motivo, null);
    }

    @Transactional
    public void fechar(Pedidos.FecharCaixa p, Contexto ctx) {
        long caixaId = abertoTravado().orElseThrow(() -> new RegraException("Não há caixa aberto."));
        if (p.contado() == null || p.contado().signum() < 0) {
            throw new RegraException("Conte o dinheiro da gaveta e informe o valor.");
        }
        BigDecimal esperado = esperado(caixaId);
        BigDecimal contado = r2(p.contado());
        BigDecimal diferenca = r2(contado.subtract(esperado));
        String obs = CatalogoService.limpo(p.obs());
        if (diferenca.signum() != 0 && obs.isEmpty()) {
            throw new RegraException("Explique a diferença no campo de observação.");
        }
        db.executar("update caixa set fechado_em = ?, fechado_por = ?, esperado = ?, contado = ?, diferenca = ?, obs = ? where id = ?",
            ctx.agora(), ctx.nome(), esperado, contado, diferenca, obs, caixaId);
        auditoria.registrar(ctx.usuario(), "Caixa fechado", "Esperado " + brl(esperado) + ", contado " + brl(contado)
            + (diferenca.signum() != 0 ? ", diferença de " + brl(diferenca) : ", sem diferença") + (obs.isEmpty() ? "" : ". " + obs), null);
    }
}
