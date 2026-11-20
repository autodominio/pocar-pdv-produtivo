-- Usuários com acesso por menu e despesas fixas mensais.

-- ---------------------------------------------------------------- usuários
-- Administrador acessa tudo e gerencia os usuários. Os usuários que já existem (os iniciais) viram administradores.
alter table usuario add column admin boolean not null default false;
update usuario set admin = true;

-- Menus que cada usuário não administrador pode abrir.
create table usuario_menu (
  usuario_id bigint      not null references usuario (id) on delete cascade,
  menu       varchar(20) not null check (menu in ('painel', 'pdv', 'caixa', 'estoque', 'financeiro', 'crediario', 'clientes', 'fidelidade', 'metas', 'auditoria')),
  primary key (usuario_id, menu)
);

-- ---------------------------------------------------------------- despesas fixas
-- Despesa que se repete todo mês (aluguel, internet, salário). O sistema cria a conta a pagar de cada mês no dia escolhido.
create table despesa_fixa (
  id          bigserial     primary key,
  descricao   varchar(200)  not null,
  categoria   varchar(60)   not null,
  valor       numeric(12,2) not null check (valor > 0),
  dia         int           not null check (dia between 1 and 31),  -- em mês mais curto, vence no último dia
  ativa       boolean       not null default true,
  inicio      char(7)       not null check (inicio ~ '^\d{4}-\d{2}$'), -- primeiro mês em que gera conta
  criado_em   timestamp     not null default localtimestamp,
  criado_por  varchar(80)   not null
);

alter table lancamento add column despesa_fixa_id bigint references despesa_fixa (id);
alter table lancamento add column competencia char(7);
-- uma conta por despesa fixa por mês
create unique index lancamento_despesa_fixa_mes_ux on lancamento (despesa_fixa_id, competencia) where despesa_fixa_id is not null;
