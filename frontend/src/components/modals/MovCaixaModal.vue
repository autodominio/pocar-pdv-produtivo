<!-- Remover do caixa (tipo interno 'sangria') ou adicionar ao caixa (tipo interno 'suprimento'). -->
<script setup>
import { storeToRefs } from 'pinia';
import { brl } from '@/domain/utils';
import { useCaixaStore } from '@/stores/caixa';

const { cxMov, movErro, resumoAtual } = storeToRefs(useCaixaStore());
const { salvarMov } = useCaixaStore();
</script>

<template>
  <div class="ov" v-if="cxMov.open" @click.self="cxMov.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mv-t">
      <div><h3 id="mv-t">{{ cxMov.tipo === 'sangria' ? 'Remover do caixa' : 'Adicionar ao caixa' }}</h3>
        <div class="muted" style="font-size:14px">{{ cxMov.tipo === 'sangria' ? 'Retirar dinheiro da gaveta, por exemplo para depositar no banco.' : 'Colocar dinheiro na gaveta, por exemplo para reforçar o troco.' }}</div></div>
      <div class="receipt" v-if="resumoAtual"><div class="row" style="justify-content:space-between"><span class="muted">Dinheiro na gaveta agora</span><b class="num" style="font-size:18px">{{ brl(resumoAtual.esperado) }}</b></div></div>
      <label class="f">Valor (R$)<input class="input" type="number" min="0" step="0.01" v-model.number="cxMov.valor"></label>
      <label class="f">Motivo<input class="input" v-model="cxMov.motivo"></label>
      <div class="tag neg" v-if="movErro && cxMov.valor">{{ movErro }}</div>
      <div class="acts"><button class="btn" @click="cxMov.open=false">Cancelar</button><button class="btn primary" :disabled="!!movErro" @click="salvarMov">{{ cxMov.tipo === 'sangria' ? 'Remover' : 'Adicionar' }}</button></div>
    </div>
  </div>
</template>
