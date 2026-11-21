<!-- Edição de produto: nome, categoria, custo, preço e estoque mínimo. -->
<script setup>
import { storeToRefs } from 'pinia';
import { brl, pct } from '@/domain/utils';
import { useCatalogStore } from '@/stores/catalog';

const { categorias, edicao, edicaoValida } = storeToRefs(useCatalogStore());
const { salvarEdicao } = useCatalogStore();
</script>

<template>
  <div class="ov" v-if="edicao.open" @click.self="edicao.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="edicao-titulo">
      <h3 id="edicao-titulo">Editar produto {{ edicao.codigo }}</h3>
      <label class="f">Nome<input class="input" v-model="edicao.nome"></label>
      <div class="grid g-2" style="gap:12px">
        <label class="f">Categoria<input class="input" v-model="edicao.categoria" list="cats-edicao"><datalist id="cats-edicao"><option v-for="c in categorias" :key="c" :value="c"></option></datalist></label>
        <label class="f">Estoque mínimo por variação<input class="input" type="number" min="0" v-model.number="edicao.min" :placeholder="edicao.minUnico ? '' : 'Diferente em cada variação'"></label>
        <label class="f">Custo (R$)<input class="input" type="number" min="0" step="0.01" v-model.number="edicao.custo"></label>
        <label class="f">Preço de venda (R$)<input class="input" type="number" min="0" step="0.01" v-model.number="edicao.preco"></label>
      </div>
      <div class="muted" style="font-size:13px" v-if="edicao.preco>0">Margem: <b style="color:var(--ink)">{{ pct(1-(edicao.custo||0)/edicao.preco) }}</b>
        <template v-if="edicao.preco !== edicao.precoAntes">. Preço atual: {{ brl(edicao.precoAntes) }}</template></div>
      <div class="muted" style="font-size:13px" v-if="!edicao.minUnico">As variações têm estoques mínimos diferentes. Deixe o campo vazio para manter, ou informe um valor para aplicar a todas.</div>
      <div class="muted" style="font-size:13px">Vendas já feitas continuam com o preço e o custo da época. A mudança fica registrada na auditoria. Se o preço mudou, imprima etiquetas novas.</div>
      <div class="acts"><button class="btn" @click="edicao.open=false">Cancelar</button><button class="btn primary" :disabled="!edicaoValida" @click="salvarEdicao">Salvar alterações</button></div>
    </div>
  </div>
</template>
