create extension if not exists unaccent;

create table usuario (
  id                bigserial primary key,
  login             varchar(40)  not null unique,
  nome              varchar(80)  not null,
  senha_hash        varchar(100) not null,
  ativo             boolean      not null default true,
  criado_em         timestamptz  not null default now(),
  senha_alterada_em timestamptz
);

-- Os dados da loja ficam num documento JSON com versão (controle de concorrência otimista).
-- Só existe uma linha (id = 1).
create table estado_loja (
  id             smallint primary key check (id = 1),
  versao         bigint not null,
  dados          jsonb,
  atualizado_em  timestamptz,
  atualizado_por varchar(40)
);
insert into estado_loja (id, versao) values (1, 0);

-- Toda alteração do documento fica guardada (o patch aplicado), para rastrear e reconstruir.
create table estado_alteracao (
  id            bigserial primary key,
  versao        bigint      not null,
  tipo          varchar(20) not null,
  patch         jsonb,
  usuario_login varchar(40) not null,
  em            timestamptz not null default now()
);
create index estado_alteracao_versao_ix on estado_alteracao (versao);

create table auditoria (
  id            bigserial primary key,
  quando        timestamptz not null default now(),
  usuario_login varchar(40),
  usuario_nome  varchar(80) not null,
  acao          varchar(120) not null,
  detalhe       text not null default '',
  versao        bigint
);
create index auditoria_quando_ix on auditoria (quando desc);

-- A auditoria só aceita inclusão: nem a aplicação consegue alterar ou apagar registros.
create function auditoria_somente_inclusao() returns trigger language plpgsql as $$
begin
  raise exception 'A auditoria não pode ser alterada nem apagada.';
end;
$$;
create trigger auditoria_imutavel before update or delete on auditoria
  for each row execute function auditoria_somente_inclusao();

-- Sessões de login (Spring Session JDBC): o login sobrevive a reinícios e atualizações da API.
create table spring_session (
  primary_id            char(36) not null,
  session_id            char(36) not null,
  creation_time         bigint   not null,
  last_access_time      bigint   not null,
  max_inactive_interval int      not null,
  expiry_time           bigint   not null,
  principal_name        varchar(100),
  constraint spring_session_pk primary key (primary_id)
);
create unique index spring_session_ix1 on spring_session (session_id);
create index spring_session_ix2 on spring_session (expiry_time);
create index spring_session_ix3 on spring_session (principal_name);

create table spring_session_attributes (
  session_primary_id char(36)     not null,
  attribute_name     varchar(200) not null,
  attribute_bytes    bytea        not null,
  constraint spring_session_attributes_pk primary key (session_primary_id, attribute_name),
  constraint spring_session_attributes_fk foreign key (session_primary_id) references spring_session (primary_id) on delete cascade
);
