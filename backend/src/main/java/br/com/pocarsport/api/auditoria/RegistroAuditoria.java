package br.com.pocarsport.api.auditoria;

/** quando: data e hora local da loja no formato AAAA-MM-DDTHH:MM, igual ao usado no frontend. */
public record RegistroAuditoria(long id, String quando, String usuario, String acao, String detalhe) {
}
