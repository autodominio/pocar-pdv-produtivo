package br.com.pocarsport.api.auth;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.pocarsport.api.auditoria.AuditoriaService;
import br.com.pocarsport.api.loja.RegraException;

/** Cadastro de usuários pelo administrador: menus liberados, senha inicial, ativar e desativar. */
@Service
public class UsuariosService {

    static final int SENHA_MINIMA = 8;

    private final UsuarioRepository usuarios;
    private final Acessos acessos;
    private final PasswordEncoder senhas;
    private final AuditoriaService auditoria;

    public UsuariosService(UsuarioRepository usuarios, Acessos acessos, PasswordEncoder senhas, AuditoriaService auditoria) {
        this.usuarios = usuarios;
        this.acessos = acessos;
        this.senhas = senhas;
        this.auditoria = auditoria;
    }

    public record Novo(String login, String nome, String senha, Boolean admin, List<String> menus) {
    }

    public record Edicao(String nome, Boolean admin, List<String> menus, Boolean ativo) {
    }

    public record NovaSenha(String senha) {
    }

    public List<Map<String, Object>> listar() {
        return usuarios.todos().stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.id());
            m.put("login", u.login());
            m.put("nome", u.nome());
            m.put("ativo", u.ativo());
            m.put("admin", u.admin());
            m.put("menus", acessos.menus(u));
            return m;
        }).toList();
    }

    @Transactional
    public long criar(Novo p, Usuario quem) {
        String login = p.login() == null ? "" : p.login().trim().toLowerCase();
        if (!login.matches("[a-z0-9._-]{3,40}")) {
            throw new RegraException("O login vai de 3 a 40 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.");
        }
        if (usuarios.porLogin(login).isPresent()) {
            throw new RegraException("Já existe um usuário com o login \"" + login + "\".");
        }
        String nome = nome(p.nome());
        if (p.senha() == null || p.senha().length() < SENHA_MINIMA) {
            throw new RegraException("A senha inicial precisa ter pelo menos " + SENHA_MINIMA + " caracteres.");
        }
        boolean admin = Boolean.TRUE.equals(p.admin());
        List<String> menus = menus(p.menus(), admin);
        long id = usuarios.criar(login, nome, senhas.encode(p.senha()), admin);
        usuarios.definirMenus(id, admin ? List.of() : menus);
        auditoria.registrar(quem, "Usuário criado", nome + " (" + login + "): " + descricaoAcesso(admin, menus), null);
        return id;
    }

    @Transactional
    public void editar(long id, Edicao p, Usuario quem) {
        Usuario u = usuarios.porId(id).orElseThrow(() -> new RegraException("Usuário não encontrado."));
        String nome = nome(p.nome());
        boolean admin = Boolean.TRUE.equals(p.admin());
        boolean ativo = !Boolean.FALSE.equals(p.ativo());
        if (u.id() == quem.id() && (!admin || !ativo)) {
            throw new RegraException("Você não pode tirar o seu próprio acesso de administrador nem se desativar.");
        }
        if (u.admin() && u.ativo() && (!admin || !ativo) && usuarios.administradoresAtivos() <= 1) {
            throw new RegraException("O sistema precisa de pelo menos um administrador ativo.");
        }
        List<String> menus = menus(p.menus(), admin);
        usuarios.atualizar(id, nome, admin, ativo);
        usuarios.definirMenus(id, admin ? List.of() : menus);
        auditoria.registrar(quem, "Usuário alterado", nome + " (" + u.login() + "): " + (ativo ? descricaoAcesso(admin, menus) : "desativado"), null);
    }

    @Transactional
    public void redefinirSenha(long id, String senha, Usuario quem) {
        Usuario u = usuarios.porId(id).orElseThrow(() -> new RegraException("Usuário não encontrado."));
        if (senha == null || senha.length() < SENHA_MINIMA) {
            throw new RegraException("A senha precisa ter pelo menos " + SENHA_MINIMA + " caracteres.");
        }
        usuarios.trocarSenha(id, senhas.encode(senha));
        auditoria.registrar(quem, "Senha redefinida", u.nome() + " (" + u.login() + ")", null);
    }

    private static String nome(String nome) {
        String n = nome == null ? "" : nome.trim().replaceAll("\\s+", " ");
        if (n.length() < 2 || n.length() > 80) {
            throw new RegraException("Informe o nome (até 80 caracteres).");
        }
        return n;
    }

    private static List<String> menus(List<String> pedidos, boolean admin) {
        if (admin) {
            return Acessos.MENUS;
        }
        List<String> menus = pedidos == null ? List.of() : pedidos.stream().distinct().toList();
        if (menus.isEmpty()) {
            throw new RegraException("Escolha pelo menos um menu para o usuário.");
        }
        if (!Acessos.MENUS.containsAll(menus)) {
            throw new RegraException("Menu desconhecido na lista.");
        }
        return Acessos.MENUS.stream().filter(menus::contains).toList();
    }

    private static String descricaoAcesso(boolean admin, List<String> menus) {
        return admin ? "administrador" : "menus " + String.join(", ", menus);
    }
}
