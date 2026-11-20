<!-- Exportação do relatório financeiro de entradas e saídas em PDF. -->
<script setup>
import CampoData from '@/components/form/CampoData.vue';
import { storeToRefs } from 'pinia';
import { REGIMES } from '@/domain/relatorios';
import { brl, dShort } from '@/domain/utils';
import { useReportsStore } from '@/stores/reports';

const { rel, presets, relErro, previa } = storeToRefs(useReportsStore());
const { aplicarPreset, gerarRelatorio } = useReportsStore();
</script>

<template>
  <div class="ov" v-if="rel.open" @click.self="rel.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rl-t">
      <div><h3 id="rl-t">Relatório financeiro em PDF</h3><div class="muted" style="font-size:14px">Entradas e saídas do período, com resumo por categoria, por forma de pagamento e a lista de lançamentos.</div></div>
      <div><div class="muted" style="font-size:13px;margin-bottom:6px">Período</div>
        <div class="chips">
          <button class="chip" v-for="p in presets" :key="p.id" :class="{on:rel.preset===p.id}" @click="aplicarPreset(p.id)">{{ p.label }}</button>
          <button class="chip" v-if="rel.preset==='custom'" :class="{on:true}">Personalizado</button>
        </div></div>
      <div class="grid g-2" style="gap:12px">
        <label class="f">De<CampoData v-model="rel.inicio" @input="rel.preset='custom'" /></label>
        <label class="f">Até<CampoData v-model="rel.fim" @input="rel.preset='custom'" /></label>
      </div>
      <div><div class="muted" style="font-size:13px;margin-bottom:6px">Regime</div>
        <div class="paygrid" style="grid-template-columns:1fr 1fr">
          <button :class="{on:rel.regime==='caixa'}" @click="rel.regime='caixa'">Caixa</button>
          <button :class="{on:rel.regime==='competencia'}" @click="rel.regime='competencia'">Competência</button>
        </div>
        <div class="muted" style="font-size:12.5px;margin-top:6px">{{ REGIMES[rel.regime].ajuda }}</div></div>
      <div><div class="muted" style="font-size:13px;margin-bottom:6px">Lista de lançamentos</div>
        <div class="paygrid" style="grid-template-columns:1fr 1fr">
          <button :class="{on:rel.agruparPorDia}" @click="rel.agruparPorDia=true">Vendas agrupadas por dia</button>
          <button :class="{on:!rel.agruparPorDia}" @click="rel.agruparPorDia=false">Um a um</button>
        </div>
        <div class="muted" style="font-size:12.5px;margin-top:6px">{{ rel.agruparPorDia ? 'Junta as vendas, taxas e recebíveis de cartão de cada dia numa linha por forma de pagamento. Os totais não mudam.' : 'Mostra cada venda, taxa e parcela separadamente. Bom para conferência detalhada.' }}</div></div>
      <label class="row" style="gap:8px;font-size:14px;flex-wrap:nowrap"><input type="checkbox" v-model="rel.incluirAbertos"> Incluir as contas a pagar e a receber que vencem no período</label>
      <div class="receipt" v-if="previa">
        <div class="row" style="justify-content:space-between" v-if="previa.totais.saldoInicial !== null"><span class="muted">Saldo em {{ dShort(previa.inicio) }}</span><span class="num">{{ brl(previa.totais.saldoInicial) }}</span></div>
        <div class="row" style="justify-content:space-between"><span class="muted">Entradas</span><span class="num pos">{{ brl(previa.totais.entradas) }}</span></div>
        <div class="row" style="justify-content:space-between"><span class="muted">Saídas</span><span class="num neg">− {{ brl(previa.totais.saidas) }}</span></div>
        <div class="row" style="justify-content:space-between;font-weight:700"><span>{{ previa.totais.saldoFinal !== null ? 'Saldo em ' + dShort(previa.fim) : 'Resultado do período' }}</span><span class="num" style="font-size:20px">{{ brl(previa.totais.saldoFinal !== null ? previa.totais.saldoFinal : previa.totais.resultado) }}</span></div>
        <div class="muted" style="font-size:12.5px">{{ previa.totais.qtdLancamentos }} lançamentos em {{ previa.linhas.length }} linhas<span v-if="rel.incluirAbertos && previa.abertos.length">, mais {{ previa.abertos.length }} {{ previa.abertos.length === 1 ? 'conta' : 'contas' }} em aberto</span></div>
      </div>
      <div class="tag neg" v-if="relErro">{{ relErro }}</div>
      <div class="acts"><button class="btn" @click="rel.open=false">Cancelar</button><button class="btn primary" :disabled="!!relErro || rel.gerando" @click="gerarRelatorio">{{ rel.gerando ? 'Gerando o PDF…' : 'Baixar PDF' }}</button></div>
    </div>
  </div>
</template>
