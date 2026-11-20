package br.com.pocarsport.api.auth;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import br.com.pocarsport.api.web.NaoAutenticadoException;

/** Resolve o usuário logado a partir da autenticação da requisição. */
@Component
public class UsuarioAtual {

    private final UsuarioRepository usuarios;

    public UsuarioAtual(UsuarioRepository usuarios) {
        this.usuarios = usuarios;
    }

    public Usuario de(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            throw new NaoAutenticadoException();
        }
        return usuarios.porLogin(auth.getName()).filter(Usuario::ativo).orElseThrow(NaoAutenticadoException::new);
    }
}
