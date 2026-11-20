package br.com.pocarsport.api.loja;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Atalhos sobre o JdbcTemplate para os serviços da loja. As linhas vêm como Map (coluna -> valor). */
@Component
public class Banco {

    private final JdbcTemplate jdbc;

    public Banco(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Executa um insert e devolve o id gerado (o SQL não deve ter "returning"). */
    public long inserir(String sql, Object... args) {
        Long id = jdbc.queryForObject(sql + " returning id", Long.class, args);
        if (id == null) {
            throw new IllegalStateException("O banco não devolveu o id do registro.");
        }
        return id;
    }

    public int executar(String sql, Object... args) {
        return jdbc.update(sql, args);
    }

    public List<Map<String, Object>> lista(String sql, Object... args) {
        return jdbc.queryForList(sql, args);
    }

    public Optional<Map<String, Object>> um(String sql, Object... args) {
        List<Map<String, Object>> l = jdbc.queryForList(sql, args);
        return l.isEmpty() ? Optional.empty() : Optional.of(l.get(0));
    }

    public BigDecimal soma(String sql, Object... args) {
        BigDecimal v = jdbc.queryForObject(sql, BigDecimal.class, args);
        return v == null ? BigDecimal.ZERO.setScale(2) : Regras.r2(v);
    }

    public long contar(String sql, Object... args) {
        Long v = jdbc.queryForObject(sql, Long.class, args);
        return v == null ? 0 : v;
    }

    public String texto(String sql, Object... args) {
        return jdbc.queryForObject(sql, String.class, args);
    }

    // ------------------------------------------------------------------ leitura de colunas

    public static BigDecimal dec(Map<String, Object> linha, String coluna) {
        Object v = linha.get(coluna);
        return v == null ? null : Regras.r2(new BigDecimal(v.toString()));
    }

    public static BigDecimal decOuZero(Map<String, Object> linha, String coluna) {
        BigDecimal v = dec(linha, coluna);
        return v == null ? BigDecimal.ZERO.setScale(2) : v;
    }

    public static Long id(Map<String, Object> linha, String coluna) {
        Object v = linha.get(coluna);
        return v == null ? null : ((Number) v).longValue();
    }

    public static int inteiro(Map<String, Object> linha, String coluna) {
        Object v = linha.get(coluna);
        return v == null ? 0 : ((Number) v).intValue();
    }

    public static String txt(Map<String, Object> linha, String coluna) {
        Object v = linha.get(coluna);
        return v == null ? null : v.toString();
    }

    public static boolean bool(Map<String, Object> linha, String coluna) {
        return Boolean.TRUE.equals(linha.get(coluna));
    }

    public static LocalDate dia(Map<String, Object> linha, String coluna) {
        Object v = linha.get(coluna);
        if (v == null) {
            return null;
        }
        if (v instanceof Date d) {
            return d.toLocalDate();
        }
        if (v instanceof Timestamp t) {
            return t.toLocalDateTime().toLocalDate();
        }
        if (v instanceof LocalDate d) {
            return d;
        }
        return LocalDate.parse(v.toString().substring(0, 10));
    }
}
