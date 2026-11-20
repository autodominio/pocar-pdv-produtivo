package br.com.pocarsport.api.auth;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UsuarioDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarios;

    public UsuarioDetailsService(UsuarioRepository usuarios) {
        this.usuarios = usuarios;
    }

    @Override
    public UserDetails loadUserByUsername(String login) {
        Usuario u = usuarios.porLogin(login).filter(Usuario::ativo)
            .orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado"));
        return User.withUsername(u.login()).password(u.senhaHash()).roles("USUARIO").build();
    }
}
