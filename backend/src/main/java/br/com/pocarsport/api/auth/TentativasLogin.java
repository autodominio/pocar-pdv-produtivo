package br.com.pocarsport.api.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/** Bloqueia o login por alguns minutos depois de várias senhas erradas seguidas (contra tentativa e erro). */
@Component
public class TentativasLogin {

    static final int MAX_FALHAS = 5;
    static final Duration BLOQUEIO = Duration.ofMinutes(5);

    private record Estado(int falhas, Instant bloqueadoAte) {
    }

    private final Map<String, Estado> porLogin = new ConcurrentHashMap<>();
    private final Clock clock;

    public TentativasLogin() {
        this(Clock.systemUTC());
    }

    TentativasLogin(Clock clock) {
        this.clock = clock;
    }

    public boolean bloqueado(String login) {
        Estado e = porLogin.get(login);
        return e != null && e.bloqueadoAte() != null && clock.instant().isBefore(e.bloqueadoAte());
    }

    public void falhou(String login) {
        porLogin.compute(login, (chave, atual) -> {
            boolean recomecar = atual == null || (atual.bloqueadoAte() != null && !clock.instant().isBefore(atual.bloqueadoAte()));
            int falhas = recomecar ? 1 : atual.falhas() + 1;
            return new Estado(falhas, falhas >= MAX_FALHAS ? clock.instant().plus(BLOQUEIO) : null);
        });
    }

    public void sucesso(String login) {
        porLogin.remove(login);
    }
}
