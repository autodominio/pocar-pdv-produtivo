-- Fotografia da loja para as telas, montada a partir das tabelas.
-- O formato (nomes e datas como texto 'AAAA-MM-DD' / 'AAAA-MM-DDTHH:MM') é o que o frontend usa nos cálculos das telas.
-- Só leitura: toda alteração passa pelos serviços da API.
select json_build_object(
  'products', coalesce((
    select json_agg(json_build_object(
      'id', p.codigo, 'nome', p.nome, 'categoria', p.categoria, 'preco', p.preco, 'custo', p.custo,
      'variantes', (select coalesce(json_agg(json_build_object(
          'sku', v.sku, 'tam', v.tamanho, 'cor', v.cor, 'qtd', v.qtd, 'min', v.estoque_minimo, 'codigoBarras', v.codigo_barras)
          order by v.ordem, v.sku), '[]') from variante v where v.produto_codigo = p.codigo)
    ) order by p.codigo) from produto p), '[]'),

  'clientes', coalesce((
    select json_agg(json_build_object(
      'id', c.id, 'nome', c.nome, 'sobrenome', c.sobrenome, 'telefone', c.telefone,
      'nascimento', to_char(c.nascimento, 'YYYY-MM-DD'), 'limite', c.limite_credito, 'criadoEm', to_char(c.criado_em, 'YYYY-MM-DD')
    ) order by c.id) from cliente c), '[]'),

  'sales', coalesce((
    select json_agg(json_build_object(
      'id', s.id, 'data', to_char(s.data, 'YYYY-MM-DD"T"HH24:MI'), 'vendedor', s.vendedor, 'clienteId', s.cliente_id,
      'itens', (select coalesce(json_agg(json_build_object(
          'sku', i.sku, 'pid', v.produto_codigo, 'nome', i.nome, 'tam', i.tamanho, 'cor', i.cor, 'preco', i.preco, 'custo', i.custo, 'qtd', i.qtd)
          order by i.id), '[]') from venda_item i join variante v on v.sku = i.sku where i.venda_id = s.id),
      'subtotal', s.subtotal, 'desconto', s.desconto,
      'valesIds', (select coalesce(json_agg(vl.id order by vl.id), '[]') from vale vl where vl.venda_uso_id = s.id),
      'valeUsado', s.vale_usado, 'cashbackUsado', s.cashback_usado, 'creditoTroca', s.credito_troca, 'total', s.total,
      'pagamento', s.pagamento, 'parcelas', s.parcelas, 'entrada', s.entrada, 'entradaForma', s.entrada_forma,
      'status', s.status, 'caixaId', s.caixa_id, 'registradoPor', s.registrado_por, 'trocaDe', s.troca_de,
      'canceladaEm', to_char(s.cancelada_em, 'YYYY-MM-DD"T"HH24:MI'), 'canceladaPor', s.cancelada_por, 'motivoCancelamento', s.motivo_cancelamento,
      'estorno', case when s.status = 'cancelada' then json_build_object('valor', coalesce(s.estorno_valor, 0), 'forma', s.estorno_forma) end,
      'devolucoes', (select coalesce(json_agg(json_build_object(
          'id', d.id, 'data', to_char(d.data, 'YYYY-MM-DD"T"HH24:MI'),
          'itens', (select coalesce(json_agg(json_build_object(
              'sku', di.sku, 'nome', di.nome, 'tam', di.tamanho, 'cor', di.cor, 'preco', di.preco, 'custo', di.custo, 'qtd', di.qtd)
              order by di.id), '[]') from devolucao_item di where di.devolucao_id = d.id),
          'valorBruto', d.valor_bruto, 'valorLiquido', d.valor_liquido, 'valor', d.valor, 'destino', d.destino, 'forma', d.forma,
          'motivo', d.motivo, 'usuario', d.usuario, 'caixaId', d.caixa_id, 'estornado', d.estornado, 'abatido', d.abatido,
          'sobraEstornada', d.sobra_estornada
        ) order by d.id), '[]') from devolucao d where d.venda_id = s.id)
    ) order by s.id) from venda s), '[]'),

  'lanc', coalesce((
    select json_agg(json_build_object(
      'id', l.id, 'data', to_char(l.data, 'YYYY-MM-DD'), 'origem', l.origem, 'vendaId', l.venda_id, 'credId', l.crediario_id,
      'parcela', l.parcela, 'tipo', l.tipo, 'categoria', l.categoria, 'descricao', l.descricao, 'valor', l.valor,
      'venc', to_char(l.venc, 'YYYY-MM-DD'), 'status', l.status, 'pagoEm', to_char(l.pago_em, 'YYYY-MM-DD'),
      'forma', l.forma, 'caixaId', l.caixa_id, 'despesaFixaId', l.despesa_fixa_id, 'competencia', l.competencia
    ) order by l.id) from lancamento l), '[]'),

  'despesasFixas', coalesce((
    select json_agg(json_build_object(
      'id', d.id, 'descricao', d.descricao, 'categoria', d.categoria, 'valor', d.valor, 'dia', d.dia, 'ativa', d.ativa, 'inicio', d.inicio
    ) order by d.ativa desc, d.dia, d.descricao) from despesa_fixa d), '[]'),

  -- só os movimentos recentes: a tela de estoque mostra os últimos
  'movs', coalesce((
    select json_agg(m.obj order by m.id) from (
      select me.id, json_build_object(
        'id', me.id, 'data', to_char(me.data, 'YYYY-MM-DD"T"HH24:MI'), 'tipo', me.tipo, 'sku', me.sku, 'nome', p.nome,
        'var', v.tamanho || ', ' || v.cor, 'qtd', me.qtd, 'origem', me.origem) as obj
      from movimento_estoque me join variante v on v.sku = me.sku join produto p on p.codigo = v.produto_codigo
      order by me.id desc limit 50) m), '[]'),

  'caixas', coalesce((
    select json_agg(json_build_object(
      'id', cx.id, 'abertoEm', to_char(cx.aberto_em, 'YYYY-MM-DD"T"HH24:MI'), 'abertoPor', cx.aberto_por,
      'valorInicial', cx.valor_inicial, 'obsAbertura', cx.obs_abertura,
      'movs', (select coalesce(json_agg(json_build_object(
          'id', cm.id, 'quando', to_char(cm.quando, 'YYYY-MM-DD"T"HH24:MI'), 'tipo', cm.tipo, 'valor', cm.valor,
          'motivo', cm.motivo, 'usuario', cm.usuario) order by cm.id), '[]') from caixa_movimento cm where cm.caixa_id = cx.id),
      'fechadoEm', to_char(cx.fechado_em, 'YYYY-MM-DD"T"HH24:MI'), 'fechadoPor', cx.fechado_por,
      'esperado', cx.esperado, 'contado', cx.contado, 'diferenca', cx.diferenca, 'obs', cx.obs
    ) order by cx.id) from caixa cx), '[]'),

  'vales', coalesce((
    select json_agg(json_build_object(
      'id', vl.id, 'clienteId', vl.cliente_id, 'valor', vl.valor, 'emitidoEm', to_char(vl.emitido_em, 'YYYY-MM-DD'),
      'validade', to_char(vl.validade, 'YYYY-MM-DD'), 'usadoEm', to_char(vl.usado_em, 'YYYY-MM-DD'), 'vendaId', vl.venda_uso_id,
      'vendaOrigem', vl.venda_origem_id, 'canceladoEm', to_char(vl.cancelado_em, 'YYYY-MM-DD'), 'origem', vl.origem
    ) order by vl.id) from vale vl), '[]'),

  'cashbacks', coalesce((
    select json_agg(json_build_object(
      'id', cb.id, 'clienteId', cb.cliente_id, 'valor', cb.valor, 'saldo', cb.saldo, 'geradoEm', to_char(cb.gerado_em, 'YYYY-MM-DD'),
      'validade', to_char(cb.validade, 'YYYY-MM-DD'), 'vendaId', cb.venda_id, 'canceladoEm', to_char(cb.cancelado_em, 'YYYY-MM-DD'),
      'origem', cb.origem
    ) order by cb.id) from cashback cb), '[]'),

  'ciclos', coalesce((
    select json_object_agg(ci.cliente_id, json_build_object('inicio', to_char(ci.inicio, 'YYYY-MM-DD'), 'acumulado', ci.acumulado))
    from ciclo_fidelidade ci), '{}'),

  'crediarios', coalesce((
    select json_agg(json_build_object(
      'id', cr.id, 'vendaId', cr.venda_id, 'clienteId', cr.cliente_id, 'data', to_char(cr.data, 'YYYY-MM-DD'), 'total', cr.total,
      'entrada', cr.entrada, 'entradaForma', cr.entrada_forma,
      'parcelas', (select coalesce(json_agg(json_build_object(
          'n', pa.n, 'valor', pa.valor, 'venc', to_char(pa.venc, 'YYYY-MM-DD'), 'pagoEm', to_char(pa.pago_em, 'YYYY-MM-DD'),
          'valorPago', pa.valor_pago, 'forma', coalesce(pa.forma, ''), 'canceladaEm', to_char(pa.cancelada_em, 'YYYY-MM-DD'))
          order by pa.n), '[]') from crediario_parcela pa where pa.crediario_id = cr.id)
    ) order by cr.id) from crediario cr), '[]'),

  'fid', (select json_build_object(
      'valeAtivo', c.vale_ativo, 'valeMeta', c.vale_meta, 'valePrazo', c.vale_prazo_dias, 'valeValor', c.vale_valor,
      'valeValidade', c.vale_validade_dias, 'cashAtivo', c.cash_ativo, 'cashPct', c.cash_pct, 'cashValidade', c.cash_validade_dias)
    from configuracao c where c.id = 1),

  'credCfg', (select json_build_object(
      'maxParcelas', c.cred_max_parcelas, 'limitePadrao', c.cred_limite_padrao, 'multa', c.cred_multa_pct,
      'jurosMes', c.cred_juros_mes_pct, 'primeiroVencDias', c.cred_primeiro_venc_dias)
    from configuracao c where c.id = 1),

  'etiquetasCfg', (select json_build_object(
      'folhaId', c.etiqueta_folha, 'campos', c.etiqueta_campos, 'ajusteX', c.etiqueta_ajuste_x, 'ajusteY', c.etiqueta_ajuste_y)
    from configuracao c where c.id = 1),

  -- número que a próxima venda vai receber (mostrado no PDV; o servidor é quem define na gravação)
  'nextSale', (select case when is_called then last_value + 1 else last_value end from venda_seq),

  -- o mês atual sempre aparece, mesmo sem meta definida
  'metas', (select json_object_agg(x.mes, x.valor) from (
      select mes, valor from meta_mes
      union all
      select to_char(current_date, 'YYYY-MM'), 0 where not exists (select 1 from meta_mes where mes = to_char(current_date, 'YYYY-MM'))
    ) x),

  'fechamentos', coalesce((
    select json_object_agg(f.mes, json_build_object(
      'vendas', f.vendas, 'bruta', f.bruta, 'descontos', f.descontos, 'fidelidade', f.fidelidade, 'devolucoes', f.devolucoes,
      'liquida', f.liquida, 'cmv', f.cmv, 'taxas', f.taxas, 'lucroBruto', f.lucro_bruto, 'despesas', f.despesas,
      'totalDespesas', f.total_despesas, 'encargos', f.encargos, 'resultado', f.resultado, 'margem', f.margem,
      'fechadoEm', to_char(f.fechado_em, 'YYYY-MM-DD'), 'obs', f.obs)) from fechamento_mes f), '{}')
)::text
