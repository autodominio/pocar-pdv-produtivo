package br.com.pocarsport.api.loja;

/** Operação recusada por uma regra de negócio. A mensagem vai para a tela como está (HTTP 422). */
public class RegraException extends RuntimeException {
    public RegraException(String mensagem) {
        super(mensagem);
    }
}
