<!-- Cancelamento da venda inteira, com estorno do que já foi recebido. -->
<script setup>
import { storeToRefs } from 'pinia';
import { FORMAS_ESTORNO } from '@/domain/constants';
import { brl } from '@/domain/utils';
import { useVendasStore } from '@/stores/vendas';

const vendas = useVendasStore();
const { venda, canc, cancPrevia, cancErro } = storeToRefs(vendas);
const { confirmarCancelamento } = vendas;
</script>

<template>
  <div class="ov" v-if="canc.open && venda && cancPrevia" @click.self="canc.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cc-t">
      <div><h3 id="cc-t">Cancelar a venda #{{ venda.id }}</h3><div class="muted" style="font-size:14px">Use quando a venda inteira for desfeita. Para devolver só algumas peças, use "Devolver ou trocar".</div></div>
      <div class="receipt" style="gap:6px">
        <b>O que vai acontecer</b>
        <div>{{ cancPrevia.pecas }} {{ cancPrevia.pecas === 1 ? 'peça volta' : 'peças voltam' }} ao estoque.</div>
        <div v-if="cancPrevia.jaRecebido > 0">{{ brl(cancPrevia.jaRecebido) }} já recebidos voltam para o cliente.</div>
        <div v-if="cancPrevia.pendenteCancelado > 0">{{ brl(cancPrevia.pendenteCancelado) }} que ainda iam entrar (cartão ou crediário) são cancelados.</div>
        <div v-if="cancPrevia.beneficiosDevolvidos > 0">{{ brl(cancPrevia.beneficiosDevolvidos) }} em vale ou cashback usados voltam para o cliente.</div>
        <div class="muted" style="font-size:13px">O cashback e o progresso de vale gerados por esta venda são retirados.</div>
      </div>
      <div v-if="cancPrevia.jaRecebido > 0"><div class="muted" style="font-size:13px;margin-bottom:6px">Como devolver os {{ brl(cancPrevia.jaRecebido) }}</div>
        <div class="paygrid" style="grid-template-columns:repeat(3,1fr)"><button v-for="(l,k) in FORMAS_ESTORNO" :key="k" :class="{on:canc.forma===k}" @click="canc.forma=k">{{ l }}</button></div></div>
      <label class="f">Motivo do cancelamento<input class="input" v-model="canc.motivo" placeholder="Ex.: cliente desistiu da compra"></label>
      <div class="tag neg" v-if="cancErro && (canc.motivo.length >= 3 || !cancPrevia.podeCancelar)">{{ cancErro }}</div>
      <div class="acts"><button class="btn" @click="canc.open=false">Voltar</button><button class="btn dark" :disabled="!!cancErro" @click="confirmarCancelamento">Confirmar cancelamento</button></div>
    </div>
  </div>
</template>
