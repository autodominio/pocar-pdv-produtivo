<!-- Edição da meta do mês da loja. -->
<script setup>
import { storeToRefs } from 'pinia';
import { curMonth, monthName } from '@/domain/utils';
import { useGoalsStore } from '@/stores/goals';

const { metasEd } = storeToRefs(useGoalsStore());
const { salvarMetas } = useGoalsStore();
</script>

<template>
  <div class="ov" v-if="metasEd.open" @click.self="metasEd.open=false">
    <div class="modal" role="dialog" aria-modal="true">
      <h3>Meta de {{ monthName(curMonth) }}</h3>
      <label class="f">Meta da loja (R$)<input class="input" type="number" min="0" step="100" v-model.number="metasEd.loja"></label>
      <div class="acts"><button class="btn" @click="metasEd.open=false">Cancelar</button><button class="btn primary" :disabled="!(metasEd.loja>0)" @click="salvarMetas">Salvar meta</button></div>
    </div>
  </div>
</template>
