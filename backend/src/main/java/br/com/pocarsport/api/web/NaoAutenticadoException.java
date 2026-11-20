package br.com.pocarsport.api.web;

public class NaoAutenticadoException extends RuntimeException {
    public NaoAutenticadoException() {
        super("Faça login para continuar.");
    }
}
