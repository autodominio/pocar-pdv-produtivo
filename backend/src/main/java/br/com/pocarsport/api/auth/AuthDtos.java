package br.com.pocarsport.api.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginPedido(@NotBlank String login, @NotBlank String senha) {
    }

    public record TrocaSenhaPedido(@NotBlank String atual, @NotBlank @Size(min = 8, max = 100) String nova) {
    }

    public record UsuarioPublico(String login, String nome) {
    }

    /** csrf: valor a enviar no cabeçalho X-XSRF-TOKEN nas requisições que alteram dados. menus: o que o usuário pode abrir. */
    public record SessaoResposta(boolean autenticado, String login, String nome, String csrf, boolean admin, java.util.List<String> menus) {
        public static SessaoResposta anonima(String csrf) {
            return new SessaoResposta(false, null, null, csrf, false, java.util.List.of());
        }
    }
}
