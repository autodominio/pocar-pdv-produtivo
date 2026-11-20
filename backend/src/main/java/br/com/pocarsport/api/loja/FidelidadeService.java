package br.com.pocarsport.api.loja;

import static br.com.pocarsport.api.loja.Regras.brl;
import static br.com.pocarsport.api.loja.Regras.max;
import static br.com.pocarsport.api.loja.Regras.min;
import static br.com.pocarsport.api.loja.Regras.r2;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.pocarsport.api.auditoria.AuditoriaService;

/** Programa de fidelidade: vale-compras por valor acumulado num prazo e cashback para a próxima compra. */
@Service
public class FidelidadeService {

    private final Banco db;
    private final AuditoriaService auditoria;

    public FidelidadeService(Banco db, AuditoriaService auditoria) {
        this.db = db;
        this.auditoria = auditoria;
    }

    record Config(boolean valeAtivo, BigDecimal valeMeta, int valePrazo, BigDecimal valeValor, int valeValidade,
                  boolean cashAtivo, BigDecimal cashPct, int cashValidade) {
    }

    Config config() {
        Map<String, Object> c = db.um("select * from configuracao where id = 1").orElseThrow();
        return new Config(Banco.bool(c, "vale_ativo"), Banco.dec(c, "vale_meta"), Banco.inteiro(c, "vale_prazo_dias"), Banco.dec(c, "vale_valor"),
            Banco.inteiro(c, "vale_validade_dias"), Banco.bool(c, "cash_ativo"), Banco.dec(c, "cash_pct"), Banco.inteiro(c, "cash_validade_dias"));
    }

    /** Vales válidos do cliente (id -> valor), do que vence antes para o que vence depois. */
    Map<Long, BigDecimal> valesValidos(long clienteId, LocalDate dia) {
        Map<Long, BigDecimal> out = new LinkedHashMap<>();
        db.lista("select id, valor from vale where cliente_id = ? and usado_em is null and cancelado_em is null and validade >= ? order by validade, id", clienteId, dia)
            .forEach(v -> out.put(Banco.id(v, "id"), Banco.dec(v, "valor")));
        return out;
    }

    BigDecimal saldoCashback(long clienteId, LocalDate dia) {
        return db.soma("select sum(saldo) from cashback where cliente_id = ? and saldo > 0 and validade >= ? and cancelado_em is null", clienteId, dia);
    }

    /** Ganhos da venda, para o recibo. */
    public record Ganhos(BigDecimal cashback, LocalDate cashValidade, BigDecimal vale, LocalDate valeValidade) {
    }

    /**
     * Consome os benefícios usados na venda e credita os novos.
     * O que passa da meta do vale já conta para o próximo; uma venda gera no máximo um vale.
     */
    Ganhos aplicar(long vendaId, Long clienteId, List<Long> valesUsados, BigDecimal cashbackUsado, BigDecimal total, LocalDate dia) {
        for (Long id : valesUsados) {
            db.executar("update vale set usado_em = ?, venda_uso_id = ? where id = ?", dia, vendaId, id);
        }
        BigDecimal resta = cashbackUsado;
        if (resta.signum() > 0 && clienteId != null) {
            for (Map<String, Object> c : db.lista("select id, saldo from cashback where cliente_id = ? and saldo > 0 and validade >= ? and cancelado_em is null "
                + "order by validade, id for update", clienteId, dia)) {
                if (resta.signum() <= 0) {
                    break;
                }
                BigDecimal usado = min(Banco.dec(c, "saldo"), resta);
                db.executar("update cashback set saldo = saldo - ? where id = ?", usado, Banco.id(c, "id"));
                resta = resta.subtract(usado);
            }
        }
        if (clienteId == null || total.signum() <= 0) {
            return new Ganhos(BigDecimal.ZERO.setScale(2), null, null, null);
        }
        Config f = config();
        BigDecimal valeGanho = null;
        LocalDate valeValidade = null;
        if (f.valeAtivo()) {
            Map<String, Object> ciclo = db.um("select inicio, acumulado from ciclo_fidelidade where cliente_id = ? for update", clienteId).orElse(null);
            boolean vigente = ciclo != null && !Banco.dia(ciclo, "inicio").plusDays(f.valePrazo()).isBefore(dia);
            BigDecimal acumulado = (vigente ? Banco.dec(ciclo, "acumulado") : BigDecimal.ZERO).add(total);
            LocalDate inicio = vigente ? Banco.dia(ciclo, "inicio") : dia;
            if (acumulado.compareTo(f.valeMeta()) >= 0) {
                valeGanho = f.valeValor();
                valeValidade = dia.plusDays(f.valeValidade());
                db.executar("insert into vale (cliente_id, valor, emitido_em, validade, venda_origem_id) values (?, ?, ?, ?, ?)",
                    clienteId, valeGanho, dia, valeValidade, vendaId);
                acumulado = acumulado.subtract(f.valeMeta());
                inicio = dia;
            }
            db.executar("insert into ciclo_fidelidade (cliente_id, inicio, acumulado) values (?, ?, ?) "
                + "on conflict (cliente_id) do update set inicio = excluded.inicio, acumulado = excluded.acumulado", clienteId, inicio, r2(acumulado));
        }
        BigDecimal cash = BigDecimal.ZERO.setScale(2);
        LocalDate cashValidade = null;
        if (f.cashAtivo() && f.cashPct().signum() > 0) {
            cash = r2(total.multiply(f.cashPct()).divide(new BigDecimal("100"), 10, RoundingMode.HALF_UP));
            if (cash.signum() > 0) {
                cashValidade = dia.plusDays(f.cashValidade());
                db.executar("insert into cashback (cliente_id, valor, saldo, gerado_em, validade, venda_id) values (?, ?, ?, ?, ?, ?)",
                    clienteId, cash, cash, dia, cashValidade, vendaId);
            }
        }
        return new Ganhos(cash, cashValidade, valeGanho, valeValidade);
    }

    /** Devolução com dinheiro de volta: o cliente não fica com benefício gerado por um valor que voltou para ele. */
    void estornarProporcional(long vendaId, Long clienteId, BigDecimal valorDevolvido, BigDecimal totalVenda) {
        BigDecimal base = totalVenda.signum() > 0 ? totalVenda : BigDecimal.ONE;
        for (Map<String, Object> c : db.lista("select id, valor, saldo from cashback where venda_id = ? for update", vendaId)) {
            BigDecimal tirar = Banco.dec(c, "valor").multiply(valorDevolvido).divide(base, 10, RoundingMode.HALF_UP);
            db.executar("update cashback set saldo = ? where id = ?", r2(max(BigDecimal.ZERO, Banco.dec(c, "saldo").subtract(tirar))), Banco.id(c, "id"));
        }
        reduzirCiclo(clienteId, valorDevolvido);
    }

    /** Cancelamento: vales e cashback usados voltam; os benefícios que a venda gerou saem. */
    void desfazer(long vendaId, Long clienteId, BigDecimal cashbackUsado, BigDecimal totalVenda, LocalDate dia) {
        db.executar("update vale set usado_em = null, venda_uso_id = null where venda_uso_id = ?", vendaId);
        if (clienteId != null && cashbackUsado.signum() > 0) {
            db.executar("insert into cashback (cliente_id, valor, saldo, gerado_em, validade, origem) values (?, ?, ?, ?, ?, ?)",
                clienteId, cashbackUsado, cashbackUsado, dia, dia.plusDays(config().cashValidade()), "Devolvido do cancelamento da venda #" + vendaId);
        }
        db.executar("update cashback set saldo = 0, cancelado_em = ? where venda_id = ?", dia, vendaId);
        db.executar("update vale set cancelado_em = ? where venda_origem_id = ? and usado_em is null", dia, vendaId);
        reduzirCiclo(clienteId, totalVenda);
    }

    private void reduzirCiclo(Long clienteId, BigDecimal valor) {
        if (clienteId != null) {
            db.executar("update ciclo_fidelidade set acumulado = greatest(0, acumulado - ?) where cliente_id = ?", valor, clienteId);
        }
    }

    /** Vale-troca: sobra de crédito de uma troca, para o cliente usar depois. */
    long valeTroca(long clienteId, BigDecimal valor, long vendaId, LocalDate dia) {
        return db.inserir("insert into vale (cliente_id, valor, emitido_em, validade, origem) values (?, ?, ?, ?, ?)",
            clienteId, valor, dia, dia.plusDays(Regras.VALIDADE_VALE_TROCA_DIAS), "Sobra da troca na venda #" + vendaId);
    }

    @Transactional
    public void salvarRegras(Pedidos.RegrasFidelidade r, Contexto ctx) {
        boolean valeAtivo = Boolean.TRUE.equals(r.valeAtivo());
        boolean cashAtivo = Boolean.TRUE.equals(r.cashAtivo());
        List<String> erros = new ArrayList<>();
        if (valeAtivo) {
            if (!Regras.positivo(r.valeMeta())) {
                erros.add("Informe o valor de compras para ganhar o vale.");
            } else if (r.valePrazo() == null || r.valePrazo() < 1) {
                erros.add("O prazo para acumular precisa ser de pelo menos 1 dia.");
            } else if (!Regras.positivo(r.valeValor()) || r.valeValor().compareTo(r.valeMeta()) >= 0) {
                erros.add("O vale precisa ser maior que zero e menor que o valor de compras exigido.");
            } else if (r.valeValidade() == null || r.valeValidade() < 1) {
                erros.add("A validade do vale precisa ser de pelo menos 1 dia.");
            }
        }
        if (cashAtivo && erros.isEmpty()) {
            if (r.cashPct() == null || r.cashPct().compareTo(BigDecimal.ONE) < 0 || r.cashPct().compareTo(new BigDecimal("50")) > 0) {
                erros.add("O cashback precisa ficar entre 1% e 50%.");
            } else if (r.cashValidade() == null || r.cashValidade() < 1) {
                erros.add("A validade do cashback precisa ser de pelo menos 1 dia.");
            }
        }
        if (!erros.isEmpty()) {
            throw new RegraException(erros.get(0));
        }
        // Com o programa desligado, os números antigos ficam guardados para quando religar.
        Config atual = config();
        db.executar("update configuracao set vale_ativo = ?, vale_meta = ?, vale_prazo_dias = ?, vale_valor = ?, vale_validade_dias = ?, "
                + "cash_ativo = ?, cash_pct = ?, cash_validade_dias = ? where id = 1",
            valeAtivo, valeAtivo ? r2(r.valeMeta()) : atual.valeMeta(), valeAtivo ? r.valePrazo() : atual.valePrazo(),
            valeAtivo ? r2(r.valeValor()) : atual.valeValor(), valeAtivo ? r.valeValidade() : atual.valeValidade(),
            cashAtivo, cashAtivo ? r.cashPct() : atual.cashPct(), cashAtivo ? r.cashValidade() : atual.cashValidade());
        auditoria.registrar(ctx.usuario(), "Regras de fidelidade alteradas",
            "Vale: " + (valeAtivo ? brl(r2(r.valeValor())) + " a cada " + brl(r2(r.valeMeta())) + " em " + r.valePrazo() + " dias" : "desativado")
                + ". Cashback: " + (cashAtivo ? r.cashPct().stripTrailingZeros().toPlainString() + "%" : "desativado"), null);
    }
}
