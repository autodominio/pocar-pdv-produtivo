<!-- Fechamento (registro) do lucro do mês. -->
<script setup>
import { storeToRefs } from 'pinia';
import { brl, monthName } from '@/domain/utils';
import { useFinanceStore } from '@/stores/finance';

const { fechamento, fechamentoPrev } = storeToRefs(useFinanceStore());
const { salvarFechamento } = useFinanceStore();
</script>

<template>
  <div class="ov" v-if="fechamento.open" @click.self="fechamento.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="fc-t">
      <h3 id="fc-t">Fechar {{ monthName(fechamento.mes, true) }}</h3>
      <div class="receipt">
        <div class="row" style="justify-content:space-between"><span class="muted">Vendas líquidas ({{ fechamentoPrev.vendas }} vendas)</span><span class="num">{{ brl(fechamentoPrev.liquida) }}</span></div>
        <div class="row" style="justify-content:space-between"><span class="muted">Custo das peças vendidas</span><span class="num">− {{ brl(fechamentoPrev.cmv) }}</span></div>
        <div class="row" style="justify-content:space-between"><span class="muted">Taxas de cartão</span><span class="num">− {{ brl(fechamentoPrev.taxas) }}</span></div>
        <div class="row" style="justify-content:space-between"><span class="muted">Despesas da loja</span><span class="num">− {{ brl(fechamentoPrev.totalDespesas) }}</span></div>
        <div class="row" style="justify-content:space-between;font-weight:700"><span>Lucro do mês</span><span class="num" style="font-size:22px" :class="fechamentoPrev.resultado>=0?'pos':'neg'">{{ brl(fechamentoPrev.resultado) }}</span></div>
      </div>
      <label class="f">Observação (opcional)<input class="input" v-model="fechamento.obs" placeholder="Ex.: conferido com o contador"></label>
      <div class="muted" style="font-size:13px">Depois de fechado, o lucro do mês fica registrado com estes valores, mesmo que algum lançamento antigo seja alterado.</div>
      <div class="acts"><button class="btn" @click="fechamento.open=false">Cancelar</button><button class="btn primary" @click="salvarFechamento">Registrar fechamento</button></div>
    </div>
  </div>
</template>
