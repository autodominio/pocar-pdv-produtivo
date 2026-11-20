package br.com.pocarsport.api.loja;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import br.com.pocarsport.api.auth.Usuario;

/** Data e hora da loja (America/Sao_Paulo), independente do fuso do servidor. */
@Component
public class Relogio {

    private final ZoneId zona;

    public Relogio(@Value("${app.zona}") String zona) {
        this.zona = ZoneId.of(zona);
    }

    public Contexto contexto(Usuario usuario) {
        LocalDateTime agora = LocalDateTime.now(zona).truncatedTo(ChronoUnit.MINUTES);
        return new Contexto(usuario, agora.toLocalDate(), agora);
    }
}
