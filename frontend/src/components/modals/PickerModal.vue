<!-- Escolha de tamanho, cor e quantidade no PDV. -->
<script setup>
import { storeToRefs } from 'pinia';
import { coresOf, qtyAt, tamsOf } from '@/domain/products';
import { brl, colorOf } from '@/domain/utils';
import { usePdvStore } from '@/stores/pdv';

const { picker, pickerMax } = storeToRefs(usePdvStore());
const { availTam, fixCor, addPicked } = usePdvStore();
</script>

<template>
  <div class="ov" v-if="picker.open" @click.self="picker.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="pk-t">
      <div><div class="muted" style="font-size:13px">{{ picker.p.categoria }}</div><h3 id="pk-t">{{ picker.p.nome }}</h3><div class="num" style="font-size:26px;font-weight:700">{{ brl(picker.p.preco) }}</div></div>
      <div><div class="muted" style="font-size:13px;margin-bottom:6px">Tamanho</div>
        <div class="chips"><button class="chip" v-for="t in tamsOf(picker.p)" :key="t" :class="{on:picker.tam===t}" :disabled="!availTam(t)" @click="picker.tam=t; fixCor()">{{ t }}</button></div></div>
      <div><div class="muted" style="font-size:13px;margin-bottom:6px">Cor</div>
        <div class="chips"><button class="chip" v-for="c in coresOf(picker.p)" :key="c" :class="{on:picker.cor===c}" :disabled="qtyAt(picker.p,picker.tam,c)===0" @click="picker.cor=c"><span class="swatch" :style="{background:colorOf(c)}"></span> {{ c }}</button></div></div>
      <div class="row" style="justify-content:space-between">
        <div class="qty"><button @click="picker.qtd=Math.max(1,picker.qtd-1)" aria-label="Diminuir">−</button><span>{{ picker.qtd }}</span><button @click="picker.qtd=Math.min(pickerMax,picker.qtd+1)" aria-label="Aumentar">+</button></div>
        <span class="muted" style="font-size:13px">{{ pickerMax }} disponíveis nesta variação</span>
      </div>
      <div class="acts"><button class="btn" @click="picker.open=false">Cancelar</button><button class="btn primary" :disabled="pickerMax<1" @click="addPicked">Adicionar à venda</button></div>
    </div>
  </div>
</template>
