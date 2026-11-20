package br.com.pocarsport.api.config;

import java.io.IOException;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

/**
 * O navegador fala só com o endereço da Vercel; a Vercel repassa /api para esta API (rewrite no vercel.json).
 * Para o navegador, frontend e API têm o mesmo endereço: sem CORS e com cookies normais.
 * - a sessão fica num cookie HttpOnly;
 * - o token CSRF fica num cookie HttpOnly e é entregue no corpo de /api/auth/sessao e /api/auth/login;
 *   o frontend guarda o valor em memória e o devolve no cabeçalho X-XSRF-TOKEN.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, SecurityContextRepository contextRepository, CookieCsrfTokenRepository csrfRepository) throws Exception {
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName(null); // token disponível já na primeira requisição
        http
            .csrf(csrf -> csrf.csrfTokenRepository(csrfRepository).csrfTokenRequestHandler(csrfHandler))
            .securityContext(sc -> sc.securityContextRepository(contextRepository))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/auth/sessao", "/api/auth/usuarios", "/actuator/health").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .anyRequest().authenticated())
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((req, res, e) -> responderJson(res, HttpServletResponse.SC_UNAUTHORIZED, "Faça login para continuar.", null))
                .accessDeniedHandler((req, res, e) -> responderJson(res, HttpServletResponse.SC_FORBIDDEN,
                    e instanceof CsrfException ? "Sessão de segurança expirada. Tente de novo." : "Acesso negado.",
                    e instanceof CsrfException ? "CSRF" : null)))
            .formLogin(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            .logout(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    CookieCsrfTokenRepository csrfTokenRepository(@Value("${server.servlet.session.cookie.secure}") boolean secure,
                                                  @Value("${server.servlet.session.cookie.same-site}") String sameSite) {
        CookieCsrfTokenRepository repo = new CookieCsrfTokenRepository(); // HttpOnly: o frontend recebe o token pelo corpo da resposta
        repo.setCookieCustomizer(cookie -> cookie.secure(secure).sameSite(sameSite));
        return repo;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    AuthenticationManager authenticationManager(UserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    private static void responderJson(HttpServletResponse res, int status, String mensagem, String codigo) throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        res.getWriter().write("{\"erro\":\"" + mensagem + "\"" + (codigo == null ? "" : ",\"codigo\":\"" + codigo + "\"") + "}");
    }
}
