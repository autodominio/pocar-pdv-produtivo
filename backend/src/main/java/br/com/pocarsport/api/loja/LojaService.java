package br.com.pocarsport.api.loja;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import br.com.pocarsport.api.auditoria.AuditoriaService;

/** Visão geral da loja para as telas, reinício dos dados e preferências de etiquetas. */
@Service
public class LojaService {

    /** Tabelas da operação, apagadas no "Reiniciar dados". Usuários, sessões e auditoria ficam. */
    private static final List<String> TABELAS_DA_LOJA = List.of(
        "ciclo_fidelidade", "cashback", "vale", "fechamento_mes", "lancamento", "despesa_fixa", "crediario_parcela", "crediario", "devolucao_item", "devolucao",
        "venda_item", "venda", "caixa_movimento", "caixa", "cliente", "movimento_estoque", "variante", "produto", "meta_mes");
    private static final List<String> FOLHAS = List.of("A4351", "A4356", "A4360");

    private final Banco db;
    private final AuditoriaService auditoria;
    private final CatalogoService catalogo;
    private final ObjectMapper json;
    private final String sqlLoja;

    public LojaService(Banco db, AuditoriaService auditoria, CatalogoService catalogo, ObjectMapper json) {
        this.db = db;
        this.auditoria = auditoria;
        this.catalogo = catalogo;
        this.json = json;
        this.sqlLoja = recurso("/sql/loja.sql");
    }

    /** Fotografia da loja (produtos, vendas, financeiro, clientes, caixa, fidelidade e configurações) em JSON. */
    @Transactional(readOnly = true)
    public String fotografia() {
        return db.texto(sqlLoja);
    }

    /** Apaga a operação e volta aos produtos e estoque iniciais. As configurações voltam ao padrão. */
    @Transactional
    public void reiniciar(Contexto ctx) {
        db.executar("truncate " + String.join(", ", TABELAS_DA_LOJA) + " restart identity");
        db.executar("alter sequence venda_seq restart with 1001");
        db.executar("alter sequence produto_seq restart with 1");
        db.executar("delete from configuracao");
        db.executar("insert into configuracao (id) values (1)");
        int pecas = catalogo.importarIniciais(ctx);
        auditoria.registrar(ctx.usuario(), "Loja reiniciada com os produtos cadastrados", "Dados anteriores substituídos (" + pecas + " peças em estoque)", null);
    }

    @Transactional
    public void salvarEtiquetas(Pedidos.ConfigEtiquetas c) {
        if (!FOLHAS.contains(c.folhaId())) {
            throw new RegraException("Folha de etiquetas desconhecida.");
        }
        BigDecimal x = c.ajusteX() == null ? BigDecimal.ZERO : c.ajusteX();
        BigDecimal y = c.ajusteY() == null ? BigDecimal.ZERO : c.ajusteY();
        if (x.abs().compareTo(new BigDecimal("5")) > 0 || y.abs().compareTo(new BigDecimal("5")) > 0) {
            throw new RegraException("O ajuste fino vai de -5 a 5 mm.");
        }
        Map<String, Boolean> campos = c.campos() == null ? Map.of() : c.campos();
        String camposJson;
        try {
            camposJson = json.writeValueAsString(campos);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        db.executar("update configuracao set etiqueta_folha = ?, etiqueta_campos = ?::jsonb, etiqueta_ajuste_x = ?, etiqueta_ajuste_y = ? where id = 1",
            c.folhaId(), camposJson, x, y);
    }

    private static String recurso(String caminho) {
        try (InputStream in = LojaService.class.getResourceAsStream(caminho)) {
            if (in == null) {
                throw new IllegalStateException("Arquivo " + caminho + " não encontrado.");
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Não foi possível ler " + caminho, e);
        }
    }
}
