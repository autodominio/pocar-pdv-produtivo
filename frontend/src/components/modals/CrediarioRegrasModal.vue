<!-- Regras do crediário. -->
<script setup>
import { storeToRefs } from 'pinia';
import { useCreditStore } from '@/stores/credit';

const { credRegras, credRegrasErro } = storeToRefs(useCreditStore());
const { salvarCredRegras } = useCreditStore();
</script>

<template>
  <div class="ov" v-if="credRegras.open" @click.self="credRegras.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cr-t">
      <h3 id="cr-t">Regras do crediário</h3>
      <div class="grid g-2" style="gap:12px">
        <label class="f">Máximo de parcelas<input class="input" type="number" min="1" max="12" v-model.number="credRegras.maxParcelas"></label>
        <label class="f">Limite padrão por cliente (R$)<input class="input" type="number" min="0" step="50" v-model.number="credRegras.limitePadrao"></label>
        <label class="f">Multa por atraso (%)<input class="input" type="number" min="0" max="2" step="0.5" v-model.number="credRegras.multa"></label>
        <label class="f">Juros por mês de atraso (%)<input class="input" type="number" min="0" step="0.5" v-model.number="credRegras.jurosMes"></label>
        <label class="f">1º vencimento após (dias)<input class="input" type="number" min="1" max="90" v-model.number="credRegras.primeiroVencDias"></label>
      </div>
      <div class="muted" style="font-size:13px">O limite de cada cliente pode ser ajustado no cadastro dele. O Código de Defesa do Consumidor limita a multa por atraso a 2%.</div>
      <div class="tag neg" v-if="credRegrasErro">{{ credRegrasErro }}</div>
      <div class="acts"><button class="btn" @click="credRegras.open=false">Cancelar</button><button class="btn primary" :disabled="!!credRegrasErro" @click="salvarCredRegras">Salvar regras</button></div>
    </div>
  </div>
</template>
