package br.com.pocarsport.api.auditoria;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AuditoriaRepository {

    private static final DateTimeFormatter FORMATO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");

    private final JdbcTemplate jdbc;
    private final ZoneId zona;

    public AuditoriaRepository(JdbcTemplate jdbc, @Value("${app.zona}") String zona) {
        this.jdbc = jdbc;
        this.zona = ZoneId.of(zona);
    }

    public void inserir(String login, String nome, String acao, String detalhe, Long versao) {
        jdbc.update("insert into auditoria (usuario_login, usuario_nome, acao, detalhe, versao) values (?, ?, ?, ?, ?)",
            login, nome, acao, detalhe, versao);
    }

    public List<RegistroAuditoria> buscar(String usuario, OffsetDateTime desde, String busca, Long antesDeId, int limite) {
        StringBuilder sql = new StringBuilder("select id, quando, usuario_nome, acao, detalhe from auditoria where 1 = 1");
        List<Object> params = new ArrayList<>();
        if (usuario != null && !usuario.isBlank()) {
            sql.append(" and usuario_nome = ?");
            params.add(usuario);
        }
        if (desde != null) {
            sql.append(" and quando >= ?");
            params.add(desde);
        }
        if (busca != null && !busca.isBlank()) {
            sql.append(" and unaccent(acao || ' ' || detalhe) ilike unaccent(?)");
            params.add("%" + busca.trim().replace("%", "\\%").replace("_", "\\_") + "%");
        }
        if (antesDeId != null) {
            sql.append(" and id < ?");
            params.add(antesDeId);
        }
        sql.append(" order by id desc limit ?");
        params.add(limite);
        return jdbc.query(sql.toString(), (rs, i) -> new RegistroAuditoria(
            rs.getLong("id"),
            rs.getObject("quando", OffsetDateTime.class).atZoneSameInstant(zona).format(FORMATO),
            rs.getString("usuario_nome"), rs.getString("acao"), rs.getString("detalhe")), params.toArray());
    }

    public List<String> usuarios() {
        return jdbc.queryForList("select distinct usuario_nome from auditoria order by 1", String.class);
    }
}
