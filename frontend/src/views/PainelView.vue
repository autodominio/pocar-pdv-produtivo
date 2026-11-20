<!-- Tela: Painel. -->
<script setup>
import { storeToRefs } from 'pinia';
import { OPERATOR } from '@/domain/constants';
import { icons } from '@/domain/icons';
import { brl, brl0, colorOf, curMonth, dShort, greeting, monthName, pct, todayIso, todayLong } from '@/domain/utils';
import { useCatalogStore } from '@/stores/catalog';
import { useFinanceStore } from '@/stores/finance';
import { useGoalsStore } from '@/stores/goals';

const operador = OPERATOR;
const { lowStock } = storeToRefs(useCatalogStore());
const { fin, finCur, contasProx, lucroMeses, lucroAtual } = storeToRefs(useFinanceStore());
const { hoje, meta, last14, last14Max, topProdutos, payMix } = storeToRefs(useGoalsStore());
const { barY } = useGoalsStore();
</script>

<template>
  <section class="content">
    <div class="row" style="justify-content:space-between">
      <div><div style="font-size:24px;font-weight:700">{{ greeting }}, {{ operador.split(' ')[0] }}.</div><div class="muted">{{ todayLong }}</div></div>
      <a class="btn primary" href="#pdv"><span v-html="icons.cart"></span>Abrir PDV</a>
    </div>
    <div class="grid g-4">
      <div class="card kpi"><div class="k">Vendido hoje</div><div class="v">{{ brl(hoje.total) }}</div><div class="s">{{ hoje.qtd }} vendas, ticket médio {{ brl(hoje.ticket) }}</div></div>
      <a class="card kpi" href="#financeiro" @click="fin.tab='lucro'; fin.mes=curMonth" style="text-decoration:none;color:inherit"><div class="k">Lucro projetado do mês</div><div class="v" :class="lucroAtual.projetado>=0?'pos':'neg'">{{ brl0(lucroAtual.projetado) }}</div><div class="s">Mês passado: {{ brl0(lucroMeses[1] ? lucroMeses[1].resultado : 0) }}</div></a>
      <div class="card kpi"><div class="k">Saldo de caixa no mês</div><div class="v" :class="finCur.saldo>=0?'pos':'neg'">{{ brl(finCur.saldo) }}</div><div class="s">Entradas menos saídas já pagas</div></div>
      <div class="card kpi"><div class="k">Estoque baixo</div><div class="v" :class="lowStock.length?'neg':''">{{ lowStock.length }}</div><div class="s">Variações no mínimo ou zeradas</div></div>
    </div>

    <div class="meta-hero">
      <div class="head">
        <div>
          <div style="color:#a0a0a0;font-size:14px">Meta de {{ monthName(curMonth) }}</div>
          <div class="vals">{{ brl(meta.realizado) }} <span>de {{ brl(meta.alvo) }}</span></div>
        </div>
        <div class="pct">{{ pct(meta.pct) }}</div>
      </div>
      <div class="stripe big"><div class="fill" :style="{width:Math.min(100,meta.pct*100)+'%'}"></div><div class="ideal" :style="{left:(meta.idealPct*100)+'%'}" title="Onde deveria estar hoje"></div></div>
      <div class="facts">
        <div><div class="k">Falta vender</div><div class="v">{{ brl(meta.falta) }}</div></div>
        <div><div class="k">Precisa por dia</div><div class="v" style="color:var(--yellow)">{{ brl(meta.porDia) }}</div></div>
        <div><div class="k">Projeção do mês</div><div class="v">{{ brl(meta.projecao) }}</div></div>
        <div><div class="k">Ritmo</div><div class="v">{{ meta.pct>=meta.idealPct ? 'À frente' : 'Atrás' }} <small style="font-size:15px;color:#a0a0a0">{{ brl(Math.abs(meta.realizado-meta.idealValor)) }}</small></div></div>
      </div>
    </div>

    <div class="grid g-main">
      <div class="card">
        <h2>Vendas dos últimos 14 dias</h2>
        <svg class="chart" viewBox="0 0 640 220" role="img" aria-label="Gráfico de vendas por dia">
          <line x1="40" x2="636" :y1="barY(meta.metaDia, last14Max)" :y2="barY(meta.metaDia, last14Max)" stroke="var(--ink)" stroke-dasharray="5 4" stroke-width="1.2" opacity=".6"></line>
          <text x="636" :y="barY(meta.metaDia, last14Max)-5" text-anchor="end">meta diária {{ brl0(meta.metaDia) }}</text>
          <g v-for="(d,i) in last14" :key="d.dia">
            <rect :x="44+i*42" :y="barY(d.total,last14Max)" width="30" :height="190-barY(d.total,last14Max)" :fill="d.total>=meta.metaDia?'var(--yellow)':'var(--muted)'" rx="2"><title>{{ d.label }}: {{ brl(d.total) }}</title></rect>
            <text :x="59+i*42" y="210" text-anchor="middle">{{ d.short }}</text>
          </g>
          <text x="0" y="20">{{ brl0(last14Max) }}</text>
          <text x="0" y="190">0</text>
        </svg>
        <div class="muted" style="font-size:13px;margin-top:6px">Barras amarelas bateram a meta diária.</div>
      </div>
      <div class="card">
        <h2>Contas dos próximos 7 dias</h2>
        <div class="list" v-if="contasProx.length">
          <div class="it" v-for="l in contasProx.slice(0,6)" :key="l.id">
            <div class="grow"><div class="t">{{ l.descricao }}</div><div class="d">{{ l.tipo==='despesa'?'A pagar':'A receber' }}, vence {{ dShort(l.venc) }}</div></div>
            <span class="tag" :class="l.venc<todayIso?'neg':(l.venc===todayIso?'warn':'')">{{ l.venc<todayIso?'Vencida':(l.venc===todayIso?'Hoje':dShort(l.venc)) }}</span>
            <b class="num" :class="l.tipo==='despesa'?'neg':'pos'" style="font-size:17px">{{ brl(l.valor) }}</b>
          </div>
        </div>
        <div class="empty" v-else>Nenhuma conta vencendo esta semana.</div>
        <a class="btn sm" href="#financeiro" style="margin-top:10px">Ver financeiro</a>
      </div>
    </div>

    <div class="grid g-3">
      <div class="card">
        <h2>Repor estoque</h2>
        <div class="list" v-if="lowStock.length">
          <div class="it" v-for="v in lowStock.slice(0,6)" :key="v.sku">
            <div class="grow"><div class="t">{{ v.nome }}</div><div class="d">{{ v.tam }}, <span class="swatch" :style="{background:colorOf(v.cor)}"></span> {{ v.cor }}</div></div>
            <span class="q-cell" :class="v.qtd===0?'zero':'low'">{{ v.qtd }}</span>
          </div>
        </div>
        <div class="empty" v-else>Tudo acima do mínimo.</div>
        <a class="btn sm" href="#estoque" style="margin-top:10px">Ver estoque</a>
      </div>
      <div class="card">
        <h2>Mais vendidos no mês</h2>
        <div class="list">
          <div class="it" v-for="p in topProdutos.slice(0,6)" :key="p.nome">
            <div class="grow"><div class="t">{{ p.nome }}</div><div class="bar-h y" style="margin-top:6px"><i :style="{width:(p.qtd/topProdutos[0].qtd*100)+'%'}"></i></div></div>
            <b class="num" style="font-size:17px">{{ p.qtd }} pç</b>
          </div>
        </div>
      </div>
      <div class="card">
        <h2>Formas de pagamento no mês</h2>
        <div class="list">
          <div class="it" v-for="p in payMix" :key="p.k">
            <div class="grow"><div class="t">{{ p.label }}</div><div class="bar-h" style="margin-top:6px"><i :style="{width:(p.share*100)+'%'}"></i></div></div>
            <div style="text-align:right"><b class="num" style="font-size:17px">{{ pct(p.share) }}</b><div class="d muted" style="font-size:12px">{{ brl(p.total) }}</div></div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
