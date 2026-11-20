package br.com.pocarsport.api.web;

/** Usuário logado sem acesso ao menu da operação (HTTP 403). */
public class AcessoNegadoException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public AcessoNegadoException(String mensagem) {
        super(mensagem);
    }
}
