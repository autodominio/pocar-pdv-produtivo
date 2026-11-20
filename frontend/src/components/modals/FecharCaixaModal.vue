<!-- Fechamento do caixa com conferência do dinheiro da gaveta. -->
<script setup>
import { storeToRefs } from 'pinia';
import { brl } from '@/domain/utils';
import { useCaixaStore } from '@/stores/caixa';

const { cxFechar, fecharErro, resumoAtual, atual, diferencaFechamento } = storeToRefs(useCaixaStore());
const { fecharCaixa } = useCaixaStore();
</script>

<template>
  <div class="ov" v-if="cxFechar.open && atual" @click.self="cxFechar.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="fx-t">
      <div><h3 id="fx-t">Fechar caixa</h3><div class="muted" style="font-size:14px">Conte o dinheiro da gaveta e compare com o que o sistema espera.</div></div>
      <div class="receipt">
        <div class="row" style="justify-content:space-between"><span class="muted">Troco inicial</span><span class="num">{{ brl(atual.valorInicial) }}</span></div>
        <div class="row" style="justify-content:space-between"><span class="muted">Entradas em dinheiro</span><span class="num">+ {{ brl(resumoAtual.dinheiroEntrou) }}</span></div>
        <div class="row" style="justify-content:space-between" v-if="resumoAtual.suprimentos"><span class="muted">Adicionado ao caixa</span><span class="num">+ {{ brl(resumoAtual.suprimentos) }}</span></div>
        <div class="row" style="justify-content:space-between" v-if="resumoAtual.dinheiroSaiu"><span class="muted">Estornos em dinheiro</span><span class="num">− {{ brl(resumoAtual.dinheiroSaiu) }}</span></div>
        <div class="row" style="justify-content:space-between" v-if="resumoAtual.sangrias"><span class="muted">Removido do caixa</span><span class="num">− {{ brl(resumoAtual.sangrias) }}</span></div>
        <div class="row" style="justify-content:space-between;font-weight:700"><span>Esperado na gaveta</span><span class="num" style="font-size:22px">{{ brl(resumoAtual.esperado) }}</span></div>
      </div>
      <div class="muted" style="font-size:13px" v-if="resumoAtual.porForma.length">Para conferir com a maquininha: {{ resumoAtual.porForma.filter(f => f.k !== 'dinheiro').map(f => f.label + ' ' + brl(f.valor)).join('; ') || 'só vendas em dinheiro' }}.</div>
      <label class="f">Dinheiro contado na gaveta (R$)<input class="input" type="number" min="0" step="0.01" v-model.number="cxFechar.contado"></label>
      <div v-if="diferencaFechamento !== null">
        <span class="tag pos" v-if="diferencaFechamento === 0">Confere com o esperado</span>
        <span class="tag" :class="diferencaFechamento < 0 ? 'neg' : 'warn'" v-else>{{ diferencaFechamento < 0 ? 'Faltam' : 'Sobram' }} {{ brl(Math.abs(diferencaFechamento)) }}</span>
      </div>
      <label class="f">Observação{{ diferencaFechamento ? ' (obrigatória quando há diferença)' : ' (opcional)' }}<input class="input" v-model="cxFechar.obs" placeholder="Ex.: troco dado a mais numa venda"></label>
      <div class="tag neg" v-if="fecharErro && cxFechar.contado !== null">{{ fecharErro }}</div>
      <div class="acts"><button class="btn" @click="cxFechar.open=false">Voltar</button><button class="btn primary" :disabled="!!fecharErro" @click="fecharCaixa">Fechar caixa</button></div>
    </div>
  </div>
</template>
