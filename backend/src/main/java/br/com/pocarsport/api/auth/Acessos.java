package br.com.pocarsport.api.auth;

import java.util.Arrays;
import java.util.List;

import org.springframework.stereotype.Component;

import br.com.pocarsport.api.web.AcessoNegadoException;

/**
 * Menus que cada usuário pode abrir. O frontend esconde o que não é liberado e o servidor confere
 * de novo em cada operação de escrita, então esconder o menu não é a única proteção.
 */
@Component
public class Acessos {

    /** Menus do sistema, na ordem do menu lateral. "usuarios" é só do administrador. */
    public static final List<String> MENUS = List.of("painel", "pdv", "caixa", "estoque", "financeiro", "crediario", "clientes", "fidelidade", "metas", "auditoria");

    private final UsuarioRepository usuarios;

    public Acessos(UsuarioRepository usuarios) {
        this.usuarios = usuarios;
    }

    /** Menus liberados, na ordem do menu lateral. */
    public List<String> menus(Usuario u) {
        if (u.admin()) {
            return MENUS;
        }
        List<String> liberados = usuarios.menus(u.id());
        return MENUS.stream().filter(liberados::contains).toList();
    }

    /** Libera se o usuário tem pelo menos um dos menus (ou é administrador). */
    public void exigir(Usuario u, String... algumDosMenus) {
        if (u.admin()) {
            return;
        }
        List<String> liberados = usuarios.menus(u.id());
        if (Arrays.stream(algumDosMenus).noneMatch(liberados::contains)) {
            throw new AcessoNegadoException("Seu usuário não tem acesso a esta área. Peça ao administrador.");
        }
    }

    public void exigirAdmin(Usuario u) {
        if (!u.admin()) {
            throw new AcessoNegadoException("Só o administrador pode fazer isso.");
        }
    }
}
