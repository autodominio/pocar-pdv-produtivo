# Pocar Sport: gestão, PDV e metas (Vue 3)

Frontend do sistema Pocar Sport (Vue 3), publicado na Vercel. As chamadas para `/api` são repassadas pela Vercel para a API na VPS (rewrite no `vercel.json`). Veja o README da raiz para a arquitetura e a publicação.

## Como rodar

Requisito: Node.js 18 ou mais novo.

```bash
npm install
npm run mock      # API simulada em http://localhost:8080 (sem Java nem banco); ou suba o backend
npm run dev       # desenvolvimento em http://localhost:5173 (encaminha /api para a porta 8080)
npm run build     # gera a pasta dist/ para publicar
npm run preview   # serve a pasta dist/ localmente
npm test          # testes das regras de negócio (Vitest)
```

## Stack

Vue 3.4 (Composition API e `<script setup>`), Pinia 2 para o estado compartilhado, Vite 5 e Vitest. Os dados vêm da API (`GET /api/loja`); cada operação chama a rota própria da API, que aplica as regras e grava nas tabelas, e as telas recarregam os dados.

## Estrutura

```
src/
  main.js                 cria o app e o Pinia
  App.vue                 casca: menu, barra superior, tela atual, modais e avisos; tecla Esc
  assets/                 CSS original (main.css) e logos
  domain/                 regras de negócio puras, sem Vue (testadas em tests/)
    constants.js          formas de pagamento, taxas, catálogo, vendedores, despesas fixas
    utils.js              datas, arredondamento e formatação (R$, %, datas)
    finance.js            venda → lançamentos financeiros; lucro do mês (DRE)
    loyalty.js            vale-compras e cashback
    credit.js             carnê do crediário, parcelas e situação de crédito do cliente
    clients.js            telefone, idade, aniversário, busca, link de WhatsApp
    products.js           estoque por variação (tamanho x cor)
    etiquetas.js          código de barras EAN-13 interno, folhas de etiquetas e posições
    relatorios.js         relatório de entradas e saídas (caixa ou competência, agrupamentos, saldos)
    sales.js              vendas válidas e faturamento líquido (cancelamentos e devoluções)
    caixa.js              resumo do caixa e dinheiro esperado na gaveta
    devolucoes.js         cancelamento de venda, devolução e troca
    seed.js               dados de demonstração
    icons.js              ícones e lista de telas do menu
  services/api.js         cliente da API (/api no mesmo endereço, token CSRF em memória, erros)
  services/relatorios.js  ponto único dos relatórios (hoje gera no navegador; depois chama a API)
  services/pdf/           PDFs do relatório financeiro e das etiquetas (jsPDF)
  stores/                 Pinia, uma store por área
    db.js                 dados da loja e sincronização com o servidor (patch, versão, conflito, nova tentativa)
    ui.js                 tela atual (#hash), tema, avisos
    pdv.js                carrinho, cliente da venda, benefícios, crediário e finalização
    catalog.js            estoque, entrada de mercadoria, novo produto
    goals.js              meta do mês, gráficos, ranking, edição de metas
    finance.js            fluxo de caixa, contas, lucro mensal, fechamento, lançamentos
    clients.js            lista, ficha e cadastro de clientes
    loyalty.js            tela e regras de fidelidade
    credit.js             tela de crediário, recebimento com multa e juros, regras
    reports.js            exportação do relatório financeiro (período, regime, prévia)
    etiquetas.js          gerador de etiquetas (folha, campos, quantidades, ajuste fino)
    session.js            login, sessão expirada e saída
    audit.js              envio de registros de auditoria e consulta no servidor
    caixa.js              abertura, sangria, suprimento, fechamento e lista de vendas
    vendas.js             detalhe da venda, devolução, troca e cancelamento
  views/                  uma tela por arquivo (Painel, PDV, Estoque, Financeiro, Crediário, Clientes, Fidelidade, Metas)
  components/layout/      menu lateral, barra superior, menu inferior do celular, atalho do carrinho
  components/modals/      janelas (escolha de tamanho, recibo, cadastro de cliente, receber parcela...)
tests/                    testes do domínio
tools/mock-api.mjs        API simulada com o mesmo contrato do backend
```

## Decisões

- **Navegação por `#hash` própria em vez de vue-router.** Mantém os mesmos endereços do protótipo (`#pdv`, `#crediario`). Com vue-router no modo hash eles virariam `#/pdv`; dá para trocar quando houver login e rotas protegidas.
- **Estado das telas nas stores.** Filtros, carrinho do PDV e mês do financeiro continuam como estavam ao trocar de tela, igual ao protótipo.
- **Regras em `domain/`, fora do Vue.** São funções puras, e por isso dá para testar sem navegador. Na versão com backend, elas viram a camada de serviço da API (Spring Boot) quase sem mudança.

## Relatório financeiro em PDF

Botão **Exportar PDF** na tela Financeiro. O usuário escolhe o período, o regime (caixa ou competência), se as vendas aparecem agrupadas por dia ou uma a uma e se entram as contas em aberto. O PDF traz:
- saldos de início e fim do período (no caixa);
- resumo de entradas e saídas por categoria;
- entradas por forma de pagamento;
- lista de lançamentos com saldo acumulado;
- contas a pagar e a receber que vencem no período.

As bibliotecas de PDF só carregam quando alguém clica em exportar, então não pesam na abertura do sistema.

Para levar ao backend, troque o corpo de `services/relatorios.js` pelo download de `GET /api/relatorios/financeiro?inicio=&fim=&regime=&formato=pdf`. A regra de `domain/relatorios.js` vira o `RelatorioFinanceiroService` no Spring Boot, e os testes em `tests/relatorios.test.js` servem de especificação.

## Login e auditoria

Login com senha no servidor. A sessão dura 12 horas e sobrevive a atualizações da API. Se ela expirar com o sistema aberto, aparece o login por cima da tela e o que estava pendente é enviado depois de entrar de novo.

Toda ação importante vai para a auditoria do servidor junto com a alteração dos dados, no mesmo envio. Usuário e horário são definidos pelo servidor, e o banco não permite alterar nem apagar registros.

## Caixa, cancelamento, devolução e troca

- **Caixa** (menu Caixa): abrir com o troco inicial, registrar sangria e suprimento, e fechar contando o dinheiro. O sistema mostra quanto deveria haver na gaveta e exige justificativa quando há diferença. O PDV só vende com o caixa aberto.
- **Cancelamento** (Caixa > Vendas > abrir a venda): desfaz a venda inteira. O estoque volta, o que ainda ia entrar (cartão, crediário) é cancelado, o que já entrou é estornado ao cliente, os vales e o cashback usados voltam para ele, e a venda sai do faturamento, da meta e do lucro.
- **Devolução**: escolhe as peças que voltam. O valor considera o que o cliente pagou, com descontos rateados. No crediário, abate primeiro das parcelas em aberto.
- **Troca**: as peças devolvidas viram crédito no PDV para os novos produtos. Se sobrar crédito, vira vale-troca para o cliente ou volta em dinheiro/Pix. A devolução só é gravada quando a nova venda é finalizada.

As regras estão em `domain/devolucoes.js` e `domain/caixa.js`, cobertas por testes em `tests/`.

## Códigos e etiquetas

- Cada variação (tamanho e cor) tem um **SKU** legível (`PS01-M-PRETO`) e um **código de barras EAN-13** gerado no cadastro do produto. Os códigos usam o prefixo 2, que o padrão GS1 reserva para uso interno da loja, então não colidem com códigos de fabricantes. Dados antigos recebem códigos automaticamente ao abrir o sistema.
- **Estoque > Etiquetas** gera o PDF para folhas A4 de etiquetas adesivas (A4351 de 65 por folha, A4356 de 33 e A4360 de 21). Dá para escolher o que aparece, imprimir uma etiqueta por peça em estoque, começar numa posição já usada da folha e fazer ajuste fino de alinhamento. A folha e o ajuste ficam salvos.
- No **PDV**, o leitor de código de barras digita o código no campo de busca e o Enter coloca a peça na venda.

## Sincronização com o servidor

- Cada alteração vira um JSON Patch, enviado 250 ms depois da última mudança (várias mudanças seguidas viram um envio só).
- O envio leva a versão em que se baseou. Se outro aparelho gravou antes, o servidor recusa e o sistema recarrega a versão mais recente com um aviso.
- Sem conexão, as alterações ficam guardadas na tela e são reenviadas a cada 5 segundos; o menu lateral mostra o estado ("Tudo salvo no servidor", "Salvando…" ou o problema). Fechar a aba com algo pendente pede confirmação.

## Publicação

Na Vercel, com Root Directory `frontend`. O `vercel.json` configura o build (testes antes), os cabeçalhos e o repasse de `/api` para a VPS. Passo a passo no README da raiz.
