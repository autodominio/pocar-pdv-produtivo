<!-- Entrada de mercadoria no estoque. -->
<script setup>
import CampoData from '@/components/form/CampoData.vue';
import { storeToRefs } from 'pinia';
import { brl } from '@/domain/utils';
import { useCatalogStore } from '@/stores/catalog';
import { useDbStore } from '@/stores/db';

const { entrada, entradaProd, entradaNova, entradaValida } = storeToRefs(useCatalogStore());
const { onEntradaProd, salvarEntrada, NOVA_VARIACAO } = useCatalogStore();
const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'Único'];
const { state } = storeToRefs(useDbStore());
</script>

<template>
  <div class="ov" v-if="entrada.open" @click.self="entrada.open=false">
    <div class="modal" role="dialog" aria-modal="true">
      <h3>Entrada de mercadoria</h3>
      <label class="f">Produto<select class="select" v-model="entrada.pid" @change="onEntradaProd"><option v-for="p in state.products" :key="p.id" :value="p.id">{{ p.nome }}</option></select></label>
      <div class="grid g-2" style="gap:12px">
        <label class="f">Variação<select class="select" v-model="entrada.sku"><option v-for="v in entradaProd.variantes" :key="v.sku" :value="v.sku">{{ v.tam }}, {{ v.cor }} (tem {{ v.qtd }})</option><option :value="NOVA_VARIACAO">+ Nova variação</option></select></label>
        <label class="f">Quantidade<input class="input" type="number" min="1" v-model.number="entrada.qtd"></label>
        <template v-if="entradaNova">
          <label class="f">Tamanho da nova variação<input class="input" v-model="entrada.novaTam" list="tams-entrada" placeholder="Ex.: GG ou 38"><datalist id="tams-entrada"><option v-for="t in [...new Set([...TAMANHOS, ...entradaProd.variantes.map(v => v.tam)])]" :key="t" :value="t"></option></datalist></label>
          <label class="f">Cor da nova variação<input class="input" v-model="entrada.novaCor" list="cores-entrada" placeholder="Ex.: Azul"><datalist id="cores-entrada"><option v-for="c in [...new Set(entradaProd.variantes.map(v => v.cor))]" :key="c" :value="c"></option></datalist></label>
          <div class="muted" style="font-size:13px;grid-column:1/-1">A variação é cadastrada com código de barras novo e o mesmo estoque mínimo das outras. Depois, imprima as etiquetas dela.</div>
        </template>
        <label class="f">Custo unitário (R$)<input class="input" type="number" min="0" step="0.01" v-model.number="entrada.custo"></label>
        <label class="f">Fornecedor<input class="input" v-model="entrada.fornecedor" placeholder="Ex.: Confecção Vitória"></label>
      </div>
      <label class="row" style="gap:8px"><input type="checkbox" v-model="entrada.gerarConta"> Lançar conta a pagar de {{ brl((entrada.qtd||0)*(entrada.custo||0)) }} no financeiro</label>
      <label class="f" v-if="entrada.gerarConta">Vencimento<CampoData v-model="entrada.venc" /></label>
      <div class="acts"><button class="btn" @click="entrada.open=false">Cancelar</button><button class="btn primary" :disabled="!entradaValida" @click="salvarEntrada">Lançar entrada</button></div>
    </div>
  </div>
</template>
