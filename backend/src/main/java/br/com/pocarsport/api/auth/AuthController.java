package br.com.pocarsport.api.auth;

import java.util.List;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.pocarsport.api.auditoria.AuditoriaService;
import br.com.pocarsport.api.auth.AuthDtos.LoginPedido;
import br.com.pocarsport.api.auth.AuthDtos.SessaoResposta;
import br.com.pocarsport.api.auth.AuthDtos.TrocaSenhaPedido;
import br.com.pocarsport.api.auth.AuthDtos.UsuarioPublico;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository contextRepository;
    private final UsuarioRepository usuarios;
    private final UsuarioAtual usuarioAtual;
    private final TentativasLogin tentativas;
    private final PasswordEncoder passwordEncoder;
    private final AuditoriaService auditoria;
    private final Acessos acessos;

    public AuthController(AuthenticationManager authenticationManager, SecurityContextRepository contextRepository, UsuarioRepository usuarios,
                          UsuarioAtual usuarioAtual, TentativasLogin tentativas, PasswordEncoder passwordEncoder, AuditoriaService auditoria,
                          Acessos acessos) {
        this.authenticationManager = authenticationManager;
        this.contextRepository = contextRepository;
        this.usuarios = usuarios;
        this.usuarioAtual = usuarioAtual;
        this.tentativas = tentativas;
        this.passwordEncoder = passwordEncoder;
        this.auditoria = auditoria;
        this.acessos = acessos;
    }

    /** Nomes para a tela de entrada (sem nenhum dado sensível). */
    @GetMapping("/usuarios")
    public List<UsuarioPublico> usuarios() {
        return usuarios.ativos().stream().map(u -> new UsuarioPublico(u.login(), u.nome())).toList();
    }

    @GetMapping("/sessao")
    public SessaoResposta sessao(Authentication auth, CsrfToken csrf) {
        String token = csrf.getToken();
        if (auth == null || auth instanceof AnonymousAuthenticationToken || !auth.isAuthenticated()) {
            return SessaoResposta.anonima(token);
        }
        return usuarios.porLogin(auth.getName()).filter(Usuario::ativo)
            .map(u -> new SessaoResposta(true, u.login(), u.nome(), token, u.admin(), acessos.menus(u)))
            .orElseGet(() -> SessaoResposta.anonima(token));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginPedido pedido, CsrfToken csrf, HttpServletRequest request, HttpServletResponse response) {
        String login = pedido.login().trim().toLowerCase();
        if (tentativas.bloqueado(login)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("erro", "Muitas tentativas erradas. Aguarde 5 minutos e tente de novo."));
        }
        try {
            Authentication auth = authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(login, pedido.senha()));
            if (request.getSession(false) != null) {
                request.changeSessionId(); // evita fixação de sessão
            }
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(auth);
            SecurityContextHolder.setContext(context);
            contextRepository.saveContext(context, request, response);
            tentativas.sucesso(login);
            Usuario u = usuarioAtual.de(auth);
            auditoria.registrar(u, "Entrou no sistema", "", null);
            return ResponseEntity.ok(new SessaoResposta(true, u.login(), u.nome(), csrf.getToken(), u.admin(), acessos.menus(u)));
        } catch (AuthenticationException e) {
            tentativas.falhou(login);
            usuarios.porLogin(login).ifPresent(u -> auditoria.registrar(u, "Tentativa de login com senha errada", "", null));
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erro", "Usuário ou senha incorretos."));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(Authentication auth, HttpServletRequest request) {
        auditoria.registrar(usuarioAtual.de(auth), "Saiu do sistema", "", null);
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/senha")
    public ResponseEntity<?> trocarSenha(@Valid @RequestBody TrocaSenhaPedido pedido, Authentication auth) {
        Usuario u = usuarioAtual.de(auth);
        if (!passwordEncoder.matches(pedido.atual(), u.senhaHash())) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of("erro", "A senha atual não confere."));
        }
        usuarios.trocarSenha(u.id(), passwordEncoder.encode(pedido.nova()));
        auditoria.registrar(u, "Senha alterada", "", null);
        return ResponseEntity.noContent().build();
    }
}
