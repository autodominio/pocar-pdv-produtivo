<!-- Atalho para o carrinho no celular, visível só no PDV. -->
<script setup>
import { storeToRefs } from 'pinia';
import { brl } from '@/domain/utils';
import { usePdvStore } from '@/stores/pdv';
import { useUiStore } from '@/stores/ui';

const { pdv, cartPecas, cartTotal, recibo } = storeToRefs(usePdvStore());
const { scrollCart } = usePdvStore();
const { view } = storeToRefs(useUiStore());
</script>

<template>
  <button class="cartbar" v-if="view==='pdv' && pdv.cart.length && !recibo" @click="scrollCart"><span>Ver venda ({{ cartPecas }} peças)</span><span class="num">{{ brl(cartTotal) }}</span></button>
</template>
