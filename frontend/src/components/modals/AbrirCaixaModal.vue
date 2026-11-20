<!-- Abertura do caixa. -->
<script setup>
import { storeToRefs } from 'pinia';
import { useCaixaStore } from '@/stores/caixa';
import { useSessionStore } from '@/stores/session';

const { cxAbrir, abrirErro } = storeToRefs(useCaixaStore());
const { abrirCaixa } = useCaixaStore();
const { usuario } = storeToRefs(useSessionStore());
</script>

<template>
  <div class="ov" v-if="cxAbrir.open" @click.self="cxAbrir.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ab-t">
      <div><h3 id="ab-t">Abrir caixa</h3><div class="muted" style="font-size:14px">Conte o dinheiro de troco que está na gaveta para começar.</div></div>
      <label class="f">Troco inicial (R$)<input class="input" type="number" min="0" step="0.01" v-model.number="cxAbrir.valor"></label>
      <label class="f">Observação (opcional)<input class="input" v-model="cxAbrir.obs" placeholder="Ex.: troco separado em notas de 5 e 10"></label>
      <div class="muted" style="font-size:13px">Responsável pela abertura: <b style="color:var(--ink)">{{ usuario }}</b></div>
      <div class="tag neg" v-if="abrirErro">{{ abrirErro }}</div>
      <div class="acts"><button class="btn" @click="cxAbrir.open=false">Cancelar</button><button class="btn primary" :disabled="!!abrirErro" @click="abrirCaixa">Abrir caixa</button></div>
    </div>
  </div>
</template>
