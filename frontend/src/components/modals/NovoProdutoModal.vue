<!-- Cadastro de produto. -->
<script setup>
import { storeToRefs } from 'pinia';
import { pct, toggleArr } from '@/domain/utils';
import { useCatalogStore } from '@/stores/catalog';

const { categorias, novo, novoCores, novoValido } = storeToRefs(useCatalogStore());
const { salvarNovo } = useCatalogStore();
</script>

<template>
  <div class="ov" v-if="novo.open" @click.self="novo.open=false">
    <div class="modal" role="dialog" aria-modal="true">
      <h3>Novo produto</h3>
      <label class="f">Nome<input class="input" v-model="novo.nome" placeholder="Ex.: Camiseta Oversized Pocar"></label>
      <div class="grid g-2" style="gap:12px">
        <label class="f">Categoria<input class="input" v-model="novo.categoria" list="cats"><datalist id="cats"><option v-for="c in categorias" :key="c" :value="c"></option></datalist></label>
        <label class="f">Estoque mínimo por variação<input class="input" type="number" min="0" v-model.number="novo.min"></label>
        <label class="f">Custo (R$)<input class="input" type="number" min="0" step="0.01" v-model.number="novo.custo"></label>
        <label class="f">Preço de venda (R$)<input class="input" type="number" min="0" step="0.01" v-model.number="novo.preco"></label>
      </div>
      <div class="muted" style="font-size:13px" v-if="novo.preco>0">Margem: <b style="color:var(--ink)">{{ pct(1-(novo.custo||0)/novo.preco) }}</b>, markup {{ ((novo.preco/(novo.custo||1))).toFixed(2) }}x</div>
      <div><div class="muted" style="font-size:13px;margin-bottom:6px">Tamanhos</div>
        <div class="chips"><button class="chip" v-for="t in ['PP','P','M','G','GG','XG','Único']" :key="t" :class="{on:novo.tams.includes(t)}" @click="toggleArr(novo.tams,t)">{{ t }}</button></div></div>
      <label class="f">Cores, separadas por vírgula<input class="input" v-model="novo.cores" placeholder="Preto, Branco, Amarelo"></label>
      <div class="muted" style="font-size:13px">Serão criadas {{ novo.tams.length * novoCores.length }} variações com estoque zero. Use “Entrada de mercadoria” para abastecer.</div>
      <div class="acts"><button class="btn" @click="novo.open=false">Cancelar</button><button class="btn primary" :disabled="!novoValido" @click="salvarNovo">Cadastrar produto</button></div>
    </div>
  </div>
</template>
