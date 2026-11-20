<!-- Tela: Metas. -->
<script setup>
import { storeToRefs } from 'pinia';
import { brl, brl0, cap, curMonth, monthName, pct } from '@/domain/utils';
import { useGoalsStore } from '@/stores/goals';

const { meta, cumulado, cumPoints, historico } = storeToRefs(useGoalsStore());
const { cumX, cumY, openMetas } = useGoalsStore();
</script>

<template>
  <section class="content">
    <div class="meta-hero">
      <div class="head">
        <div>
          <div style="color:#a0a0a0;font-size:14px">Meta da loja em {{ monthName(curMonth) }}</div>
          <div class="vals">{{ brl(meta.realizado) }} <span>de {{ brl(meta.alvo) }}</span></div>
        </div>
        <div class="row" style="align-items:flex-end;gap:18px">
          <button class="btn sm" @click="openMetas">Editar meta</button>
          <div class="pct">{{ pct(meta.pct) }}</div>
        </div>
      </div>
      <div class="stripe big"><div class="fill" :style="{width:Math.min(100,meta.pct*100)+'%'}"></div><div class="ideal" :style="{left:(meta.idealPct*100)+'%'}" title="Onde deveria estar hoje"></div></div>
      <div class="facts">
        <div><div class="k">Dias restantes</div><div class="v">{{ meta.diasRest }}</div></div>
        <div><div class="k">Média por dia até agora</div><div class="v">{{ brl(meta.media) }}</div></div>
        <div><div class="k">Precisa por dia daqui pra frente</div><div class="v" style="color:var(--yellow)">{{ brl(meta.porDia) }}</div></div>
        <div><div class="k">Projeção de fechamento</div><div class="v">{{ brl(meta.projecao) }} <small style="font-size:15px;color:#a0a0a0">{{ pct(meta.projecao/meta.alvo) }}</small></div></div>
      </div>
    </div>

    <div class="grid g-main">
      <div class="card">
        <h2>Acumulado do mês contra o ritmo ideal</h2>
        <svg class="chart" viewBox="0 0 640 240" role="img" aria-label="Acumulado de vendas contra a meta">
          <line x1="40" y1="210" :x2="cumX(meta.dim)" :y2="cumY(meta.alvo)" stroke="var(--muted)" stroke-dasharray="6 5" stroke-width="1.5"></line>
          <line x1="40" x2="640" :y1="cumY(meta.alvo)" :y2="cumY(meta.alvo)" stroke="var(--line)"></line>
          <text x="44" :y="cumY(meta.alvo)-6">meta {{ brl0(meta.alvo) }}</text>
          <polyline :points="cumPoints" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"></polyline>
          <circle v-if="cumulado.length" :cx="cumX(cumulado.length)" :cy="cumY(cumulado[cumulado.length-1])" r="6" fill="var(--yellow)" stroke="var(--ink)" stroke-width="2"></circle>
          <text v-for="d in [1,5,10,15,20,25,meta.dim]" :key="d" :x="cumX(d)" y="230" text-anchor="middle">{{ d }}</text>
          <text x="36" y="214" text-anchor="end">0</text>
        </svg>
        <div class="row muted" style="font-size:13px"><span>Linha cheia: vendido. Tracejada: ritmo necessário para fechar a meta.</span></div>
      </div>
      <div class="card">
        <h2>Histórico de metas</h2>
        <div class="list">
          <div class="it" v-for="h in historico" :key="h.mes">
            <div class="grow"><div class="t">{{ cap(monthName(h.mes, true)) }}</div><div class="d">{{ brl0(h.realizado) }} de {{ brl0(h.alvo) }}</div><div class="bar-h y" style="margin-top:6px"><i :style="{width:Math.min(100,h.realizado/h.alvo*100)+'%'}"></i></div></div>
            <span class="tag" :class="h.mes===curMonth?'warn':(h.realizado>=h.alvo?'pos':'neg')">{{ h.mes===curMonth?'Em andamento':(h.realizado>=h.alvo?'Batida':'Não batida') }}</span>
            <b class="num" style="font-size:18px;min-width:52px;text-align:right">{{ pct(h.realizado/h.alvo) }}</b>
          </div>
        </div>
      </div>
    </div>

  </section>
</template>
