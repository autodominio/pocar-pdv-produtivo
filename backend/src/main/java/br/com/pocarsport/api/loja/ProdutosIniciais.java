package br.com.pocarsport.api.loja;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import br.com.pocarsport.api.auth.Usuario;

/** Na primeira subida (loja sem produtos e sem vendas), carrega os produtos e o estoque da planilha. */
@Component
public class ProdutosIniciais implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ProdutosIniciais.class);
    static final Usuario SISTEMA = new Usuario(0, "sistema", "Sistema", "", true, true);

    private final Banco db;
    private final CatalogoService catalogo;
    private final Relogio relogio;

    public ProdutosIniciais(Banco db, CatalogoService catalogo, Relogio relogio) {
        this.db = db;
        this.catalogo = catalogo;
        this.relogio = relogio;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (db.contar("select count(*) from produto") > 0 || db.contar("select count(*) from venda") > 0) {
            return;
        }
        int pecas = catalogo.importarIniciais(relogio.contexto(SISTEMA));
        log.info("Produtos iniciais carregados: {} peças em estoque.", pecas);
    }
}
