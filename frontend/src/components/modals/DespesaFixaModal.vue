<!-- Nova despesa fixa ou edição: descrição, categoria, valor mensal e dia do pagamento. -->
<script setup>
import { storeToRefs } from 'pinia';
import { CAT_DESP } from '@/domain/constants';
import { useFinanceStore } from '@/stores/finance';

const { fixa, fixaErro } = storeToRefs(useFinanceStore());
const { salvarFixa } = useFinanceStore();
</script>

<template>
  <div class="ov" v-if="fixa.open" @click.self="fixa.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="fx-t">
      <h3 id="fx-t">{{ fixa.id ? 'Editar despesa fixa' : 'Nova despesa fixa' }}</h3>
      <label class="f">Descrição<input class="input" v-model="fixa.descricao" placeholder="Ex.: Aluguel da loja"></label>
      <div class="grid g-2" style="gap:12px">
        <label class="f">Categoria<select class="select" v-model="fixa.categoria"><option v-for="c in CAT_DESP.filter(c => c !== 'Fornecedores')" :key="c">{{ c }}</option></select></label>
        <label class="f">Valor mensal (R$)<input class="input" type="number" min="0" step="0.01" v-model.number="fixa.valor"></label>
        <label class="f">Dia do pagamento<input class="input" type="number" min="1" max="31" step="1" v-model.number="fixa.dia"></label>
      </div>
      <p class="muted" style="font-size:13px;margin:0">A conta deste mês é criada se o dia ainda não passou; senão, a primeira é a do mês que vem.</p>
      <div class="muted" style="font-size:13px" v-if="fixaErro">{{ fixaErro }}</div>
      <div class="acts"><button class="btn" @click="fixa.open=false">Cancelar</button><button class="btn primary" :disabled="!!fixaErro" @click="salvarFixa">Salvar despesa fixa</button></div>
    </div>
  </div>
</template>
