package br.com.pocarsport.api.web;

public class SenhaConfirmacaoException extends RuntimeException {
    public SenhaConfirmacaoException() {
        super("Senha incorreta. Para substituir todos os dados, confirme com a sua senha.");
    }
}
