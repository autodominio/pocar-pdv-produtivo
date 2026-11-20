<!-- Recebimento de parcela do crediário. -->
<script setup>
import { storeToRefs } from 'pinia';
import { PAY_LABEL } from '@/domain/constants';
import { brl, dShort } from '@/domain/utils';
import { useCreditStore } from '@/stores/credit';
import { useDbStore } from '@/stores/db';

const { receb, recebInfo } = storeToRefs(useCreditStore());
const { receberParcela } = useCreditStore();
const { state } = storeToRefs(useDbStore());
</script>

<template>
  <div class="ov" v-if="receb.open && recebInfo" @click.self="receb.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rc-t">
      <div><h3 id="rc-t">Receber parcela {{ recebInfo.p.n }}/{{ recebInfo.cr.parcelas.length }}</h3><div class="muted" style="font-size:14px">{{ recebInfo.nome }}, venda #{{ recebInfo.cr.vendaId }}, vencimento em {{ dShort(recebInfo.p.venc) }}</div></div>
      <div class="receipt">
        <div class="row" style="justify-content:space-between"><span class="muted">Valor da parcela</span><span class="num">{{ brl(recebInfo.p.valor) }}</span></div>
        <template v-if="recebInfo.dias>0 && receb.encargos">
          <div class="row" style="justify-content:space-between"><span class="muted">Multa ({{ state.credCfg.multa }}%)</span><span class="num">+ {{ brl(recebInfo.multa) }}</span></div>
          <div class="row" style="justify-content:space-between"><span class="muted">Juros ({{ state.credCfg.jurosMes }}% ao mês, {{ recebInfo.dias }} dias)</span><span class="num">+ {{ brl(recebInfo.juros) }}</span></div>
        </template>
        <div class="row" style="justify-content:space-between;font-weight:700"><span>Total a receber</span><span class="num" style="font-size:22px">{{ brl(recebInfo.total) }}</span></div>
      </div>
      <label class="row" style="gap:8px;font-size:14px" v-if="recebInfo.dias>0"><input type="checkbox" v-model="receb.encargos"> Cobrar multa e juros pelos {{ recebInfo.dias }} dias de atraso</label>
      <div><div class="muted" style="font-size:13px;margin-bottom:5px">Forma de pagamento</div>
        <div class="paygrid" style="grid-template-columns:repeat(3,1fr)"><button v-for="k in ['pix','dinheiro','debito']" :key="k" :class="{on:receb.forma===k}" @click="receb.forma=k">{{ PAY_LABEL[k] }}</button></div></div>
      <div class="acts"><button class="btn" @click="receb.open=false">Cancelar</button><button class="btn primary" @click="receberParcela">Confirmar recebimento</button></div>
    </div>
  </div>
</template>
