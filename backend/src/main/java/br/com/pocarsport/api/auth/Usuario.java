package br.com.pocarsport.api.auth;

/** admin: acessa todos os menus e gerencia os usuários. Os demais acessam só os menus liberados (tabela usuario_menu). */
public record Usuario(long id, String login, String nome, String senhaHash, boolean ativo, boolean admin) {
}
