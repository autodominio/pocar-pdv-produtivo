package br.com.pocarsport.api.loja;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Confere o arquivo gerado por "npm run importar-produtos" antes de a API tentar carregá-lo. */
class ProdutosIniciaisArquivoTest {

    @Test
    void arquivoNoFormatoEsperado() throws Exception {
        JsonNode produtos;
        try (InputStream in = getClass().getResourceAsStream(CatalogoService.PRODUTOS_INICIAIS)) {
            assertTrue(in != null, "produtos-iniciais.json não encontrado");
            produtos = new ObjectMapper().readTree(in);
        }
        assertTrue(produtos.isArray() && produtos.size() > 0, "lista de produtos vazia");
        Set<String> codigos = new HashSet<>();
        Set<String> skus = new HashSet<>();
        for (JsonNode p : produtos) {
            assertTrue(codigos.add(p.path("id").asText()), "código repetido: " + p.path("id").asText());
            assertTrue(p.path("codigo").isMissingNode() && !p.path("nome").asText().isBlank() && !p.path("categoria").asText().isBlank(), "produto sem nome/categoria");
            assertTrue(p.path("id").asText().length() <= 20, "código longo demais");
            assertTrue(p.path("preco").decimalValue().signum() >= 0 && p.path("custo").decimalValue().signum() >= 0, "preço ou custo negativo");
            for (JsonNode v : p.path("variantes")) {
                assertTrue(skus.add(v.path("sku").asText()), "SKU repetido: " + v.path("sku").asText());
                assertTrue(v.path("qtd").asInt(-1) >= 0, "quantidade negativa");
                assertTrue(!v.path("tam").asText().isBlank() && !v.path("cor").asText().isBlank(), "variação sem tamanho/cor");
            }
        }
        assertEquals(skus.size(), (int) skus.stream().distinct().count());
    }
}
