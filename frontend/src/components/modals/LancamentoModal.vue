<!-- Novo lançamento financeiro. -->
<script setup>
import CampoData from '@/components/form/CampoData.vue';
import { storeToRefs } from 'pinia';
import { CAT_DESP, CAT_REC } from '@/domain/constants';
import { useFinanceStore } from '@/stores/finance';

const { lanc } = storeToRefs(useFinanceStore());
const { salvarLanc } = useFinanceStore();
</script>

<template>
  <div class="ov" v-if="lanc.open" @click.self="lanc.open=false">
    <div class="modal" role="dialog" aria-modal="true">
      <h3>Novo lançamento</h3>
      <div class="paygrid" style="grid-template-columns:1fr 1fr"><button :class="{on:lanc.tipo==='despesa'}" @click="lanc.tipo='despesa'">Despesa</button><button :class="{on:lanc.tipo==='receita'}" @click="lanc.tipo='receita'">Receita</button></div>
      <label class="f">Descrição<input class="input" v-model="lanc.descricao" placeholder="Ex.: Conta de água"></label>
      <div class="grid g-2" style="gap:12px">
        <label class="f">Categoria<select class="select" v-model="lanc.categoria"><option v-for="c in (lanc.tipo==='despesa'?CAT_DESP:CAT_REC)" :key="c">{{ c }}</option></select></label>
        <label class="f">Valor (R$)<input class="input" type="number" min="0" step="0.01" v-model.number="lanc.valor"></label>
        <label class="f">Vencimento<CampoData v-model="lanc.venc" /></label>
        <label class="f">Situação<select class="select" v-model="lanc.status"><option value="pendente">Pendente</option><option value="pago">{{ lanc.tipo==='despesa'?'Pago':'Recebido' }}</option></select></label>
      </div>
      <div class="acts"><button class="btn" @click="lanc.open=false">Cancelar</button><button class="btn primary" :disabled="!(lanc.descricao && lanc.valor>0 && lanc.venc)" @click="salvarLanc">Salvar lançamento</button></div>
    </div>
  </div>
</template>
