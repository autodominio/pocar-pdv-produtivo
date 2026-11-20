package br.com.pocarsport.api.web;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.session.web.http.SessionRepositoryFilter;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Uma linha de log por chamada à API, por exemplo:
 *   POST /api/vendas -> 200 (38 ms) usuario=leonardo ip=189.10.20.30
 *
 * Roda logo depois do filtro da sessão e antes do Spring Security, então registra também
 * as respostas 401/403 que a segurança devolve. Não registra corpo, senha nem cookie.
 * O /actuator/health fica de fora porque o healthcheck do Docker o chama a cada poucos segundos.
 */
@Component
@Order(SessionRepositoryFilter.DEFAULT_ORDER + 1)
public class LogRequisicoesFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger("api.requisicoes");

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/actuator");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long inicio = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            long ms = (System.nanoTime() - inicio) / 1_000_000;
            int status = response.getStatus();
            String linha = String.format("%s %s -> %d (%d ms) usuario=%s ip=%s",
                request.getMethod(), request.getRequestURI(), status, ms, usuario(request), request.getRemoteAddr());
            if (status >= 500) {
                log.error(linha);
            } else if (status >= 400) {
                log.warn(linha);
            } else {
                log.info(linha);
            }
        }
    }

    /** Lê o usuário da sessão, pois o Spring Security já limpou o contexto da thread quando a resposta volta. */
    private static String usuario(HttpServletRequest request) {
        try {
            HttpSession sessao = request.getSession(false);
            if (sessao == null) {
                return "-";
            }
            Object ctx = sessao.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
            if (ctx instanceof SecurityContext sc) {
                Authentication auth = sc.getAuthentication();
                if (auth != null && auth.isAuthenticated()) {
                    return auth.getName();
                }
            }
        } catch (IllegalStateException sessaoEncerrada) {
            // logout invalida a sessão durante a requisição
        }
        return "-";
    }
}
