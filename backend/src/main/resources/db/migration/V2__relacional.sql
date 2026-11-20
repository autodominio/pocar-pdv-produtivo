-- Modelo relacional da loja. Substitui o documento JSON (estado_loja), que deixa de existir:
-- a produção começa limpa, com os produtos da planilha carregados pela aplicação na primeira subida.
drop table if exists estado_alteracao;
drop table if exists estado_loja;

-- ---------------------------------------------------------------- configuração
create table configuracao (
  id                       smallint primary key default 1 check (id = 1),
  -- fidelidade: vale-compras por valor acumulado e cashback
  vale_ativo               boolean       not null default true,
  vale_meta                numeric(12,2) not null default 1000 check (vale_meta > 0),
  vale_prazo_dias          int           not null default 90 check (vale_prazo_dias >= 1),
  vale_valor               numeric(12,2) not null default 100 check (vale_valor > 0),
  vale_validade_dias       int           not null default 60 check (vale_validade_dias >= 1),
  cash_ativo               boolean       not null default true,
  cash_pct                 numeric(5,2)  not null default 10 check (cash_pct between 0 and 50),
  cash_validade_dias       int           not null default 30 check (cash_validade_dias >= 1),
  -- crediário
  cred_max_parcelas        int           not null default 6 check (cred_max_parcelas between 1 and 12),
  cred_limite_padrao       numeric(12,2) not null default 1500 check (cred_limite_padrao >= 0),
  cred_multa_pct           numeric(5,2)  not null default 2 check (cred_multa_pct between 0 and 2),
  cred_juros_mes_pct       numeric(5,2)  not null default 1 check (cred_juros_mes_pct between 0 and 10),
  cred_primeiro_venc_dias  int           not null default 30 check (cred_primeiro_venc_dias between 1 and 90),
  -- etiquetas: preferências da impressão
  etiqueta_folha           varchar(20)   not null default 'A4351',
  etiqueta_campos          jsonb         not null default '{"nome":true,"variacao":true,"preco":true,"sku":false,"codigoBarras":true,"loja":false}',
  etiqueta_ajuste_x        numeric(4,1)  not null default 0,
  etiqueta_ajuste_y        numeric(4,1)  not null default 0,
  -- próximo número do código de barras interno (EAN-13 com prefixo 2)
  proximo_codigo_barras    bigint        not null default 1
);
insert into configuracao (id) values (1);

create table meta_mes (
  mes   char(7) primary key check (mes ~ '^\d{4}-\d{2}$'),
  valor numeric(12,2) not null check (valor >= 0)
);

-- ---------------------------------------------------------------- produtos e estoque
create table produto (
  codigo     varchar(20)   primary key,
  nome       varchar(120)  not null,
  categoria  varchar(60)   not null,
  preco      numeric(12,2) not null check (preco >= 0),
  custo      numeric(12,2) not null default 0 check (custo >= 0),
  criado_em  timestamp     not null default localtimestamp
);
create sequence produto_seq;

create table variante (
  sku            varchar(40)  primary key,
  produto_codigo varchar(20)  not null references produto (codigo),
  tamanho        varchar(20)  not null,
  cor            varchar(40)  not null,
  qtd            int          not null default 0 check (qtd >= 0),
  estoque_minimo int          not null default 0 check (estoque_minimo >= 0),
  codigo_barras  char(13)     not null unique,
  ordem          int          not null default 0,  -- ordem de exibição (PP, P, M, G…)
  unique (produto_codigo, tamanho, cor)
);
create index variante_produto_ix on variante (produto_codigo);

create table movimento_estoque (
  id       bigserial    primary key,
  data     timestamp    not null default localtimestamp,
  tipo     varchar(10)  not null check (tipo in ('entrada', 'saida')),
  sku      varchar(40)  not null references variante (sku),
  qtd      int          not null check (qtd > 0),
  origem   varchar(200) not null,
  usuario  varchar(80)
);
create index movimento_estoque_data_ix on movimento_estoque (data desc);

-- ---------------------------------------------------------------- clientes
create table cliente (
  id              bigserial     primary key,
  nome            varchar(80)   not null,
  sobrenome       varchar(80)   not null,
  telefone        varchar(11)   not null unique check (telefone ~ '^\d{10,11}$'),
  nascimento      date          not null,
  limite_credito  numeric(12,2) check (limite_credito >= 0),  -- null: usa o limite padrão do crediário
  criado_em       date          not null default current_date
);

-- ---------------------------------------------------------------- caixa
create table caixa (
  id            bigserial     primary key,
  aberto_em     timestamp     not null default localtimestamp,
  aberto_por    varchar(80)   not null,
  valor_inicial numeric(12,2) not null check (valor_inicial >= 0),
  obs_abertura  varchar(300)  not null default '',
  fechado_em    timestamp,
  fechado_por   varchar(80),
  esperado      numeric(12,2),
  contado       numeric(12,2),
  diferenca     numeric(12,2),
  obs           varchar(500)  not null default ''
);
-- só pode haver um caixa aberto por vez
create unique index caixa_um_aberto_ux on caixa ((true)) where fechado_em is null;

create table caixa_movimento (
  id       bigserial     primary key,
  caixa_id bigint        not null references caixa (id),
  quando   timestamp     not null default localtimestamp,
  tipo     varchar(10)   not null check (tipo in ('sangria', 'suprimento')),
  valor    numeric(12,2) not null check (valor > 0),
  motivo   varchar(300)  not null,
  usuario  varchar(80)   not null
);
create index caixa_movimento_caixa_ix on caixa_movimento (caixa_id);

-- ---------------------------------------------------------------- vendas
create sequence venda_seq start 1001;
create table venda (
  id                  bigint        primary key default nextval('venda_seq'),
  data                timestamp     not null default localtimestamp,
  vendedor            varchar(80)   not null,
  cliente_id          bigint        references cliente (id),
  subtotal            numeric(12,2) not null check (subtotal >= 0),
  desconto            numeric(12,2) not null default 0 check (desconto >= 0),
  vale_usado          numeric(12,2) not null default 0 check (vale_usado >= 0),
  cashback_usado      numeric(12,2) not null default 0 check (cashback_usado >= 0),
  credito_troca       numeric(12,2) not null default 0 check (credito_troca >= 0),
  total               numeric(12,2) not null check (total >= 0),
  pagamento           varchar(10)   not null check (pagamento in ('pix', 'credito', 'debito', 'dinheiro', 'crediario')),
  parcelas            int           not null default 1 check (parcelas between 1 and 12),
  entrada             numeric(12,2) not null default 0 check (entrada >= 0),
  entrada_forma       varchar(10),
  status              varchar(12)   not null default 'concluida' check (status in ('concluida', 'cancelada')),
  caixa_id            bigint        not null references caixa (id),
  registrado_por      varchar(80)   not null,
  troca_de            bigint        references venda (id),
  cancelada_em        timestamp,
  cancelada_por       varchar(80),
  motivo_cancelamento varchar(300),
  estorno_valor       numeric(12,2),
  estorno_forma       varchar(10),
  check (subtotal - desconto - vale_usado - cashback_usado - credito_troca = total)
);
create index venda_data_ix on venda (data);
create index venda_cliente_ix on venda (cliente_id);
create index venda_caixa_ix on venda (caixa_id);

-- Nome, preço e custo ficam gravados como eram no momento da venda.
create table venda_item (
  id        bigserial     primary key,
  venda_id  bigint        not null references venda (id),
  sku       varchar(40)   not null references variante (sku),
  nome      varchar(120)  not null,
  tamanho   varchar(20)   not null,
  cor       varchar(40)   not null,
  preco     numeric(12,2) not null check (preco >= 0),
  custo     numeric(12,2) not null check (custo >= 0),
  qtd       int           not null check (qtd > 0),
  unique (venda_id, sku)
);

create table devolucao (
  id              bigserial     primary key,
  venda_id        bigint        not null references venda (id),
  data            timestamp     not null default localtimestamp,
  valor_bruto     numeric(12,2) not null,
  valor_liquido   numeric(12,2) not null,
  valor           numeric(12,2) not null,
  destino         varchar(10)   not null check (destino in ('estorno', 'troca')),
  forma           varchar(10),
  motivo          varchar(300)  not null,
  usuario         varchar(80)   not null,
  caixa_id        bigint        references caixa (id),
  estornado       numeric(12,2) not null default 0,
  abatido         numeric(12,2) not null default 0,
  sobra_estornada numeric(12,2) not null default 0
);
create index devolucao_venda_ix on devolucao (venda_id);

create table devolucao_item (
  id           bigserial     primary key,
  devolucao_id bigint        not null references devolucao (id),
  sku          varchar(40)   not null references variante (sku),
  nome         varchar(120)  not null,
  tamanho      varchar(20)   not null,
  cor          varchar(40)   not null,
  preco        numeric(12,2) not null,
  custo        numeric(12,2) not null,
  qtd          int           not null check (qtd > 0)
);

-- ---------------------------------------------------------------- crediário
create table crediario (
  id            bigserial     primary key,
  venda_id      bigint        not null unique references venda (id),
  cliente_id    bigint        not null references cliente (id),
  data          date          not null,
  total         numeric(12,2) not null,
  entrada       numeric(12,2) not null default 0,
  entrada_forma varchar(10)
);

create table crediario_parcela (
  crediario_id bigint        not null references crediario (id),
  n            int           not null check (n >= 1),
  valor        numeric(12,2) not null check (valor >= 0),
  venc         date          not null,
  pago_em      date,
  valor_pago   numeric(12,2) not null default 0,
  forma        varchar(10),
  cancelada_em date,
  primary key (crediario_id, n)
);

-- ---------------------------------------------------------------- financeiro
create table lancamento (
  id           bigserial     primary key,
  data         date          not null,
  origem       varchar(20)   not null,
  venda_id     bigint        references venda (id),
  crediario_id bigint,
  parcela      int,
  tipo         varchar(10)   not null check (tipo in ('receita', 'despesa')),
  categoria    varchar(60)   not null,
  descricao    varchar(300)  not null,
  valor        numeric(12,2) not null check (valor >= 0),
  venc         date          not null,
  status       varchar(10)   not null check (status in ('pago', 'pendente', 'cancelado')),
  pago_em      date,
  forma        varchar(10),
  caixa_id     bigint        references caixa (id),
  foreign key (crediario_id, parcela) references crediario_parcela (crediario_id, n),
  check (status <> 'pago' or pago_em is not null)
);
create index lancamento_venda_ix on lancamento (venda_id);
create index lancamento_caixa_ix on lancamento (caixa_id);
create index lancamento_venc_ix on lancamento (venc) where status = 'pendente';

create table fechamento_mes (
  mes            char(7)       primary key,
  vendas         int           not null,
  bruta          numeric(12,2) not null,
  descontos      numeric(12,2) not null,
  fidelidade     numeric(12,2) not null,
  devolucoes     numeric(12,2) not null,
  liquida        numeric(12,2) not null,
  cmv            numeric(12,2) not null,
  taxas          numeric(12,2) not null,
  lucro_bruto    numeric(12,2) not null,
  total_despesas numeric(12,2) not null,
  encargos       numeric(12,2) not null,
  resultado      numeric(12,2) not null,
  margem         numeric       not null,
  despesas       jsonb         not null default '[]',  -- detalhe por categoria, como estava no dia do fechamento
  fechado_em     date          not null,
  fechado_por    varchar(80)   not null,
  obs            varchar(500)  not null default ''
);

-- ---------------------------------------------------------------- fidelidade
create table vale (
  id              bigserial     primary key,
  cliente_id      bigint        not null references cliente (id),
  valor           numeric(12,2) not null check (valor > 0),
  emitido_em      date          not null,
  validade        date          not null,
  usado_em        date,
  venda_uso_id    bigint        references venda (id),  -- venda em que foi usado
  venda_origem_id bigint        references venda (id),  -- venda que gerou o vale (vale-compras)
  cancelado_em    date,
  origem          varchar(200)                          -- preenchido no vale-troca
);
create index vale_cliente_ix on vale (cliente_id);

create table cashback (
  id           bigserial     primary key,
  cliente_id   bigint        not null references cliente (id),
  valor        numeric(12,2) not null check (valor > 0),
  saldo        numeric(12,2) not null check (saldo >= 0),
  gerado_em    date          not null,
  validade     date          not null,
  venda_id     bigint        references venda (id),
  cancelado_em date,
  origem       varchar(200),
  check (saldo <= valor)
);
create index cashback_cliente_ix on cashback (cliente_id);

-- Quanto o cliente já acumulou rumo ao próximo vale-compras.
create table ciclo_fidelidade (
  cliente_id bigint        primary key references cliente (id),
  inicio     date          not null,
  acumulado  numeric(12,2) not null check (acumulado >= 0)
);
