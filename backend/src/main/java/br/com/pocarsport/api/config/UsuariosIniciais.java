package br.com.pocarsport.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import br.com.pocarsport.api.auth.UsuarioRepository;

/**
 * Cria os usuários definidos em APP_USUARIOS ("login:Nome:senha;login2:Nome2:senha2") que ainda não existem.
 * Quem já existe não é alterado: depois da primeira subida, a senha é trocada pelo próprio sistema.
 * Os usuários iniciais são administradores; os demais são criados na tela Usuários.
 */
@Component
public class UsuariosIniciais implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(UsuariosIniciais.class);
    static final int SENHA_MINIMA = 8;

    private final UsuarioRepository usuarios;
    private final PasswordEncoder passwordEncoder;
    private final String configuracao;

    public UsuariosIniciais(UsuarioRepository usuarios, PasswordEncoder passwordEncoder, @Value("${app.usuarios:}") String configuracao) {
        this.usuarios = usuarios;
        this.passwordEncoder = passwordEncoder;
        this.configuracao = configuracao;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (configuracao == null || configuracao.isBlank()) {
            if (usuarios.ativos().isEmpty()) {
                log.warn("Nenhum usuário cadastrado. Defina APP_USUARIOS no .env para criar os usuários iniciais.");
            }
            return;
        }
        for (String item : configuracao.split(";")) {
            String[] partes = item.trim().split(":", 3);
            if (partes.length != 3 || partes[0].isBlank() || partes[1].isBlank()) {
                log.warn("Entrada inválida em APP_USUARIOS (use login:Nome:senha). Ignorada.");
                continue;
            }
            String login = partes[0].trim().toLowerCase();
            if (usuarios.porLogin(login).isPresent()) {
                continue;
            }
            if (partes[2].length() < SENHA_MINIMA) {
                log.warn("Senha inicial de '{}' tem menos de {} caracteres. Usuário não criado.", login, SENHA_MINIMA);
                continue;
            }
            usuarios.criar(login, partes[1].trim(), passwordEncoder.encode(partes[2]), true); // usuários iniciais são administradores
            log.info("Usuário '{}' criado.", login);
        }
    }
}
