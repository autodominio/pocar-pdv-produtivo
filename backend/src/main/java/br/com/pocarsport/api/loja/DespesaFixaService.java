package br.com.pocarsport.api.loja;

import static br.com.pocarsport.api.loja.Regras.brl;
import static br.com.pocarsport.api.loja.Regras.r2;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.pocarsport.api.auditoria.AuditoriaService;

/**
 * Despesas fixas (aluguel, internet, salário): o sistema cria sozinho a conta a pagar de cada mês, no dia escolhido.
 * Ficam sempre lançadas a conta do mês atual e a do próximo, para aparecerem em "Contas a pagar" com antecedência.
 */
@Service
public class DespesaFixaService {

    private final Banco db;
    private final AuditoriaService auditoria;

    public DespesaFixaService(Banco db, AuditoriaService auditoria) {
        this.db = db;
        this.auditoria = auditoria;
    }

    /** Vencimento no mês: o dia escolhido ou, em mês mais curto, o último dia (dia 31 em fevereiro vence dia 28). */
    static LocalDate vencimento(YearMonth mes, int dia) {
        return mes.atDay(Math.min(dia, mes.lengthOfMonth()));
    }

    /** Primeiro mês com conta: este, se o dia ainda não passou; senão o próximo (não cria conta já vencida). */
    static YearMonth primeiroMes(int dia, LocalDate hoje) {
        YearMonth atual = YearMonth.from(hoje);
        return vencimento(atual, dia).isBefore(hoje) ? atual.plusMonths(1) : atual;
    }

    static String descricaoDoMes(String descricao, YearMonth mes) {
        return descricao + " (" + String.format("%02d/%d", mes.getMonthValue(), mes.getYear()) + ")";
    }

    @Transactional
    public long salvar(Long id, Pedidos.DespesaFixa p, Contexto ctx) {
        String descricao = CatalogoService.limpo(p.descricao());
        if (descricao.isEmpty()) {
            throw new RegraException("Informe a descrição (ex.: Aluguel da loja).");
        }
        if (!Regras.CAT_DESPESAS.contains(p.categoria())) {
            throw new RegraException("Escolha uma categoria da lista.");
        }
        if (!Regras.positivo(p.valor())) {
            throw new RegraException("Informe o valor mensal.");
        }
        if (p.dia() == null || p.dia() < 1 || p.dia() > 31) {
            throw new RegraException("O dia do pagamento vai de 1 a 31.");
        }
        BigDecimal valor = r2(p.valor());
        int dia = p.dia();
        boolean ativa = !Boolean.FALSE.equals(p.ativa());
        YearMonth atual = YearMonth.from(ctx.hoje());

        if (id == null) {
            long novo = db.inserir("insert into despesa_fixa (descricao, categoria, valor, dia, ativa, inicio, criado_em, criado_por) values (?, ?, ?, ?, true, ?, ?, ?)",
                descricao, p.categoria(), valor, dia, primeiroMes(dia, ctx.hoje()).toString(), ctx.agora(), ctx.nome());
            auditoria.registrar(ctx.usuario(), "Despesa fixa criada", descricao + ": " + brl(valor) + " todo dia " + dia, null);
            gerarContas(ctx.hoje());
            return novo;
        }

        Map<String, Object> atualDb = db.um("select * from despesa_fixa where id = ? for update", id)
            .orElseThrow(() -> new RegraException("Despesa fixa não encontrada."));
        boolean estavaAtiva = Banco.bool(atualDb, "ativa");
        String inicio = Banco.txt(atualDb, "inicio");
        if (ativa && !estavaAtiva) {
            inicio = primeiroMes(dia, ctx.hoje()).toString(); // reativada: volta a gerar a partir de agora
        }
        db.executar("update despesa_fixa set descricao = ?, categoria = ?, valor = ?, dia = ?, ativa = ?, inicio = ? where id = ?",
            descricao, p.categoria(), valor, dia, ativa, inicio, id);

        if (ativa) {
            // contas em aberto deste mês em diante passam a ter os valores novos; as pagas ficam como foram pagas
            db.executar("update lancamento set status = 'pendente' where despesa_fixa_id = ? and status = 'cancelado' and competencia >= ?", id, inicio);
            List<Map<String, Object>> abertas = db.lista("select id, competencia from lancamento where despesa_fixa_id = ? and status = 'pendente' and competencia >= ?",
                id, atual.toString());
            for (Map<String, Object> l : abertas) {
                YearMonth mes = YearMonth.parse(Banco.txt(l, "competencia"));
                LocalDate venc = vencimento(mes, dia);
                db.executar("update lancamento set descricao = ?, categoria = ?, valor = ?, venc = ?, data = ? where id = ?",
                    descricaoDoMes(descricao, mes), p.categoria(), valor, venc, venc, Banco.id(l, "id"));
            }
            gerarContas(ctx.hoje());
        } else {
            db.executar("update lancamento set status = 'cancelado' where despesa_fixa_id = ? and status = 'pendente' and competencia >= ?", id, atual.toString());
        }
        auditoria.registrar(ctx.usuario(), ativa ? "Despesa fixa alterada" : "Despesa fixa desativada",
            descricao + ": " + brl(valor) + " todo dia " + dia, null);
        return id;
    }

    /** Cria a conta do mês atual e a do próximo de cada despesa fixa ativa, se ainda não existem. Pode rodar quantas vezes for. */
    @Transactional
    public void gerarContas(LocalDate hoje) {
        YearMonth atual = YearMonth.from(hoje);
        for (Map<String, Object> d : db.lista("select id, descricao, categoria, valor, dia, inicio from despesa_fixa where ativa")) {
            YearMonth inicio = YearMonth.parse(Banco.txt(d, "inicio"));
            for (YearMonth mes : List.of(atual, atual.plusMonths(1))) {
                if (mes.isBefore(inicio)) {
                    continue;
                }
                LocalDate venc = vencimento(mes, Banco.inteiro(d, "dia"));
                db.executar("insert into lancamento (data, origem, tipo, categoria, descricao, valor, venc, status, despesa_fixa_id, competencia) "
                        + "select ?, 'Despesa fixa', 'despesa', ?, ?, ?, ?, 'pendente', ?, ? "
                        + "where not exists (select 1 from lancamento where despesa_fixa_id = ? and competencia = ?)",
                    venc, Banco.txt(d, "categoria"), descricaoDoMes(Banco.txt(d, "descricao"), mes), Banco.dec(d, "valor"), venc,
                    Banco.id(d, "id"), mes.toString(), Banco.id(d, "id"), mes.toString());
            }
        }
    }
}
