<!-- Regras do programa de fidelidade. -->
<script setup>
import { storeToRefs } from 'pinia';
import { useLoyaltyStore } from '@/stores/loyalty';

const { regras, regrasErro } = storeToRefs(useLoyaltyStore());
const { salvarRegras } = useLoyaltyStore();
</script>

<template>
  <div class="ov" v-if="regras.open" @click.self="regras.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rg-t">
      <h3 id="rg-t">Regras do programa de fidelidade</h3>
      <label class="row" style="gap:8px"><input type="checkbox" v-model="regras.valeAtivo"><b>Vale-compras por valor acumulado</b></label>
      <div class="grid g-2" style="gap:12px" v-if="regras.valeAtivo">
        <label class="f">Comprar a partir de (R$)<input class="input" type="number" min="1" step="50" v-model.number="regras.valeMeta"></label>
        <label class="f">Dentro de (dias)<input class="input" type="number" min="1" v-model.number="regras.valePrazo"></label>
        <label class="f">Ganha vale de (R$)<input class="input" type="number" min="1" step="10" v-model.number="regras.valeValor"></label>
        <label class="f">Vale válido por (dias)<input class="input" type="number" min="1" v-model.number="regras.valeValidade"></label>
      </div>
      <label class="row" style="gap:8px"><input type="checkbox" v-model="regras.cashAtivo"><b>Cashback para a próxima compra</b></label>
      <div class="grid g-2" style="gap:12px" v-if="regras.cashAtivo">
        <label class="f">Percentual do valor pago (%)<input class="input" type="number" min="1" max="50" v-model.number="regras.cashPct"></label>
        <label class="f">Cashback válido por (dias)<input class="input" type="number" min="1" v-model.number="regras.cashValidade"></label>
      </div>
      <div class="muted" style="font-size:13px">As regras novas valem a partir da próxima venda. Vales e cashback já gerados mantêm valor e prazo originais.</div>
      <div class="tag neg" v-if="regrasErro">{{ regrasErro }}</div>
      <div class="acts"><button class="btn" @click="regras.open=false">Cancelar</button><button class="btn primary" :disabled="!!regrasErro" @click="salvarRegras">Salvar regras</button></div>
    </div>
  </div>
</template>
