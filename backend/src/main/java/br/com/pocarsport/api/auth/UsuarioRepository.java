package br.com.pocarsport.api.auth;

import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class UsuarioRepository {

    private static final String COLUNAS = "select id, login, nome, senha_hash, ativo, admin from usuario";
    private static final RowMapper<Usuario> MAPPER = (rs, i) -> new Usuario(
        rs.getLong("id"), rs.getString("login"), rs.getString("nome"), rs.getString("senha_hash"), rs.getBoolean("ativo"), rs.getBoolean("admin"));

    private final JdbcTemplate jdbc;

    public UsuarioRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Usuario> porLogin(String login) {
        return jdbc.query(COLUNAS + " where login = ?", MAPPER, login).stream().findFirst();
    }

    public List<Usuario> ativos() {
        return jdbc.query(COLUNAS + " where ativo order by nome", MAPPER);
    }

    public long criar(String login, String nome, String senhaHash, boolean admin) {
        Long id = jdbc.queryForObject("insert into usuario (login, nome, senha_hash, admin) values (?, ?, ?, ?) returning id", Long.class, login, nome, senhaHash, admin);
        return id == null ? 0 : id;
    }

    public Optional<Usuario> porId(long id) {
        return jdbc.query(COLUNAS + " where id = ?", MAPPER, id).stream().findFirst();
    }

    public List<Usuario> todos() {
        return jdbc.query(COLUNAS + " order by ativo desc, nome", MAPPER);
    }

    public void atualizar(long id, String nome, boolean admin, boolean ativo) {
        jdbc.update("update usuario set nome = ?, admin = ?, ativo = ? where id = ?", nome, admin, ativo, id);
    }

    public List<String> menus(long id) {
        return jdbc.queryForList("select menu from usuario_menu where usuario_id = ? order by menu", String.class, id);
    }

    public void definirMenus(long id, List<String> menus) {
        jdbc.update("delete from usuario_menu where usuario_id = ?", id);
        for (String m : menus) {
            jdbc.update("insert into usuario_menu (usuario_id, menu) values (?, ?)", id, m);
        }
    }

    public long administradoresAtivos() {
        Long n = jdbc.queryForObject("select count(*) from usuario where admin and ativo", Long.class);
        return n == null ? 0 : n;
    }

    public void trocarSenha(long id, String senhaHash) {
        jdbc.update("update usuario set senha_hash = ?, senha_alterada_em = now() where id = ?", senhaHash, id);
    }
}
