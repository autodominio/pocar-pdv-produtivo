package br.com.pocarsport.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

class TentativasLoginTest {

    /** Relógio que o teste consegue avançar. */
    static final class RelogioManual extends Clock {
        private Instant agora = Instant.parse("2026-11-08T12:00:00Z");

        void avancar(Duration d) {
            agora = agora.plus(d);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return agora;
        }
    }

    private final RelogioManual relogio = new RelogioManual();
    private final TentativasLogin tentativas = new TentativasLogin(relogio);

    @Test
    void bloqueiaDepoisDeCincoSenhasErradasELiberaDepoisDoPrazo() {
        for (int i = 0; i < TentativasLogin.MAX_FALHAS - 1; i++) {
            tentativas.falhou("leonardo");
        }
        assertThat(tentativas.bloqueado("leonardo")).isFalse();
        tentativas.falhou("leonardo");
        assertThat(tentativas.bloqueado("leonardo")).isTrue();
        assertThat(tentativas.bloqueado("admin")).isFalse();

        relogio.avancar(TentativasLogin.BLOQUEIO.plusSeconds(1));
        assertThat(tentativas.bloqueado("leonardo")).isFalse();
        tentativas.falhou("leonardo");
        assertThat(tentativas.bloqueado("leonardo")).isFalse();
    }

    @Test
    void loginCertoZeraAsFalhas() {
        for (int i = 0; i < TentativasLogin.MAX_FALHAS - 1; i++) {
            tentativas.falhou("leonardo");
        }
        tentativas.sucesso("leonardo");
        tentativas.falhou("leonardo");
        assertThat(tentativas.bloqueado("leonardo")).isFalse();
    }
}
