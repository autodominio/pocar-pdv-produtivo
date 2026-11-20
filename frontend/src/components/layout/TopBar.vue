<!-- Barra superior com título da tela e mini contador da meta. -->
<script setup>
import { storeToRefs } from 'pinia';
import { curMonth, monthName, pct } from '@/domain/utils';
import { useGoalsStore } from '@/stores/goals';
import { useUiStore } from '@/stores/ui';

const { meta } = storeToRefs(useGoalsStore());
const { currentView } = storeToRefs(useUiStore());
</script>

<template>
  <header class="top">
    <img class="mobile-brand" src="@/assets/logo-p.png" alt="Pocar Sport">
    <h1>{{ currentView.title }}</h1>
    <a class="mini-meta" href="#metas" style="text-decoration:none;color:inherit" :title="'Meta de '+monthName(curMonth)">
      <span class="lbl">Meta de {{ monthName(curMonth) }} <b>{{ pct(meta.pct) }}</b></span>
      <div class="stripe"><div class="fill" :style="{width:Math.min(100,meta.pct*100)+'%'}"></div><div class="ideal" :style="{left:(meta.idealPct*100)+'%'}"></div></div>
    </a>
  </header>
</template>
