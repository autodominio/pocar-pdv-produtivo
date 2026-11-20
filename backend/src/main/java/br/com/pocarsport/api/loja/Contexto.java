package br.com.pocarsport.api.loja;

import java.time.LocalDate;
import java.time.LocalDateTime;

import br.com.pocarsport.api.auth.Usuario;

/** Quem está fazendo a operação e quando (no fuso da loja). */
public record Contexto(Usuario usuario, LocalDate hoje, LocalDateTime agora) {

    public String nome() {
        return usuario.nome();
    }
}
