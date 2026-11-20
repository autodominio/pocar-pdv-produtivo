package br.com.pocarsport.api.loja;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Corpos das requisições da API da loja. A validação de cada campo fica nos serviços, com mensagens para a tela. */
public final class Pedidos {

    private Pedidos() {
    }

    // ------------------------------------------------------------------ produtos e estoque
    public record NovoProduto(String nome, String categoria, BigDecimal preco, BigDecimal custo, Integer minimo,
                              List<String> tamanhos, List<String> cores) {
    }

    public record EntradaMercadoria(String sku, Integer qtd, BigDecimal custo, String fornecedor, Boolean gerarConta, LocalDate venc) {
    }

    // ------------------------------------------------------------------ clientes
    public record Cliente(String nome, String sobrenome, String telefone, LocalDate nascimento, BigDecimal limite) {
    }

    // ------------------------------------------------------------------ caixa
    public record AbrirCaixa(BigDecimal valor, String obs) {
    }

    public record MovimentoCaixa(String tipo, BigDecimal valor, String motivo) {
    }

    public record FecharCaixa(BigDecimal contado, String obs) {
    }

    // ------------------------------------------------------------------ vendas
    public record ItemVenda(String sku, Integer qtd) {
    }

    public record CrediarioVenda(BigDecimal entrada, String entradaForma, Integer parcelas, LocalDate primeiroVenc) {
    }

    /** Troca: peças da venda original que voltam e viram crédito nesta venda. sobraDestino: vale | dinheiro | pix. */
    public record TrocaVenda(Long vendaId, Map<String, Integer> qtds, String motivo, String sobraDestino) {
    }

    public record Venda(List<ItemVenda> itens, Long clienteId, BigDecimal desconto, String descontoTipo, List<Long> valesIds,
                        Boolean usarCashback, String pagamento, Integer parcelas, BigDecimal recebido, CrediarioVenda crediario,
                        TrocaVenda troca) {
    }

    /** Devolução com dinheiro de volta (a troca entra pela venda nova). forma: dinheiro | pix | cartao. */
    public record Devolucao(Map<String, Integer> qtds, String forma, String motivo) {
    }

    public record Cancelamento(String forma, String motivo) {
    }

    // ------------------------------------------------------------------ crediário e financeiro
    public record RecebimentoParcela(String forma, Boolean cobrarEncargos) {
    }

    public record Lancamento(String tipo, String descricao, String categoria, BigDecimal valor, LocalDate venc, String status) {
    }

    /** Despesa que se repete todo mês. dia: dia do pagamento (1 a 31). ativa = false para de gerar contas. */
    public record DespesaFixa(String descricao, String categoria, BigDecimal valor, Integer dia, Boolean ativa) {
    }

    public record Fechamento(String obs) {
    }

    public record Meta(BigDecimal valor) {
    }

    // ------------------------------------------------------------------ configurações
    public record RegrasFidelidade(Boolean valeAtivo, BigDecimal valeMeta, Integer valePrazo, BigDecimal valeValor, Integer valeValidade,
                                   Boolean cashAtivo, BigDecimal cashPct, Integer cashValidade) {
    }

    public record RegrasCrediario(Integer maxParcelas, BigDecimal limitePadrao, BigDecimal multa, BigDecimal jurosMes, Integer primeiroVencDias) {
    }

    public record ConfigEtiquetas(String folhaId, Map<String, Boolean> campos, BigDecimal ajusteX, BigDecimal ajusteY) {
    }

    // ------------------------------------------------------------------ outros
    public record Reinicio(String senhaConfirmacao) {
    }

    /** Ação feita só na tela (PDF de relatório ou etiquetas) que entra na auditoria. */
    public record RegistroTela(String acao, String detalhe) {
    }
}
