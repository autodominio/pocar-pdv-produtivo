<!-- Tela: Fidelidade. -->
<script setup>
import { storeToRefs } from 'pinia';
import { nomeCompleto } from '@/domain/clients';
import { brl, brl0, curMonth, dShort, monthName } from '@/domain/utils';
import { useClientsStore } from '@/stores/clients';
import { useDbStore } from '@/stores/db';
import { useLoyaltyStore } from '@/stores/loyalty';

const { cliDet } = storeToRefs(useClientsStore());
const { state } = storeToRefs(useDbStore());
const { fidKpi, fidq, fidLista, fidResumo, fidExtrato } = storeToRefs(useLoyaltyStore());
const { openRegras, waAviso } = useLoyaltyStore();
</script>

<template>
  <section class="content">
    <div class="grid g-4">
      <div class="card kpi"><div class="k">Benefícios em aberto</div><div class="v">{{ brl0(fidKpi.passivo) }}</div><div class="s">{{ fidKpi.valesAtivos }} vales e {{ brl(fidKpi.cashAtivo) }} em cashback que ainda podem virar desconto</div></div>
      <div class="card kpi"><div class="k">Vales em {{ monthName(curMonth) }}</div><div class="v">{{ fidKpi.valesEmitidos }}</div><div class="s">emitidos, {{ fidKpi.valesUsados }} usados ({{ brl0(fidKpi.valesUsadosValor) }})</div></div>
      <div class="card kpi"><div class="k">Cashback em {{ monthName(curMonth) }}</div><div class="v">{{ brl0(fidKpi.cashGerado) }}</div><div class="s">gerado, {{ brl0(fidKpi.cashUsado) }} já usado</div></div>
      <div class="card kpi"><div class="k">Perto do vale</div><div class="v">{{ fidResumo.perto }}</div><div class="s">clientes com 70% ou mais do valor exigido</div></div>
    </div>
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <div><h2 style="margin:0">Regras</h2><div class="muted" style="font-size:14px">Aplicadas automaticamente no PDV quando a venda tem cliente identificado.</div></div>
        <button class="btn" @click="openRegras">Editar regras</button>
      </div>
      <div class="grid g-2" style="gap:12px">
        <div class="fid-rule" :class="{off:!state.fid.valeAtivo}">
          <div class="row" style="justify-content:space-between"><b>Vale-compras</b><span class="tag" :class="state.fid.valeAtivo?'pos':''">{{ state.fid.valeAtivo ? 'Ativo' : 'Desativado' }}</span></div>
          <div>Comprou {{ brl0(state.fid.valeMeta) }} em até {{ state.fid.valePrazo }} dias, ganha {{ brl0(state.fid.valeValor) }} em vale-compras, válido por {{ state.fid.valeValidade }} dias.</div>
          <div class="muted" style="font-size:13px">Em {{ monthName(curMonth) }}: {{ fidKpi.valesEmitidos }} vales emitidos, {{ fidKpi.valesUsados }} usados ({{ brl(fidKpi.valesUsadosValor) }})</div>
        </div>
        <div class="fid-rule" :class="{off:!state.fid.cashAtivo}">
          <div class="row" style="justify-content:space-between"><b>Cashback</b><span class="tag" :class="state.fid.cashAtivo?'pos':''">{{ state.fid.cashAtivo ? 'Ativo' : 'Desativado' }}</span></div>
          <div>{{ state.fid.cashPct }}% do valor pago volta como crédito para usar na próxima compra, válido por {{ state.fid.cashValidade }} dias.</div>
          <div class="muted" style="font-size:13px">Em {{ monthName(curMonth) }}: {{ brl(fidKpi.cashGerado) }} gerados, {{ brl(fidKpi.cashUsado) }} usados</div>
        </div>
      </div>
    </div>
    <div class="grid g-main g-cli">
      <div class="card">
        <h2>Clientes no programa <small>{{ fidResumo.participando }} participando</small></h2>
        <div class="row" style="margin-bottom:12px"><input class="input" v-model="fidq.busca" placeholder="Buscar por nome ou telefone" style="flex:1;min-width:180px" aria-label="Buscar cliente no programa"></div>
        <div class="chips" style="margin-bottom:12px">
          <button class="chip" :class="{on:fidq.filtro===''}" @click="fidq.filtro=''">Todos</button>
          <button class="chip" :class="{on:fidq.filtro==='perto'}" @click="fidq.filtro='perto'">Perto do vale</button>
          <button class="chip" :class="{on:fidq.filtro==='vale'}" @click="fidq.filtro='vale'">Com vale ativo</button>
          <button class="chip" :class="{on:fidq.filtro==='vencendo'}" @click="fidq.filtro='vencendo'">Vencendo em 7 dias ({{ fidResumo.vencendo }})</button>
        </div>
        <div class="scroll-x"><table>
          <thead><tr><th>Cliente</th><th style="min-width:180px">Rumo ao vale</th><th class="r">Vales</th><th class="r">Cashback</th><th></th></tr></thead>
          <tbody><tr v-for="x in fidLista" :key="x.c.id">
            <td style="white-space:nowrap"><b>{{ nomeCompleto(x.c) }}</b><div v-if="x.vencendo"><span class="tag warn">Vence em {{ dShort(x.proxVenc) }}</span></div></td>
            <td>
              <template v-if="state.fid.valeAtivo">
                <div class="bar-h y"><i :style="{width:Math.min(100,x.prog*100)+'%'}"></i></div>
                <div class="muted" style="font-size:12px;margin-top:3px">{{ brl0(x.ciclo.acumulado) }} de {{ brl0(state.fid.valeMeta) }}<span v-if="x.ciclo.fim">, até {{ dShort(x.ciclo.fim) }}</span></div>
              </template>
              <span class="muted" v-else>Desativado</span>
            </td>
            <td class="r num" style="font-size:16px">{{ x.valesTotal ? brl(x.valesTotal) : '—' }}</td>
            <td class="r num" style="font-size:16px">{{ x.cashSaldo > 0 ? brl(x.cashSaldo) : '—' }}</td>
            <td style="white-space:nowrap;text-align:right">
              <a class="btn sm" v-if="x.valesTotal || x.cashSaldo > 0" :href="waAviso(x)" target="_blank" rel="noopener">Avisar</a>
              <button class="btn sm ghost" @click="cliDet=x.c">Ficha</button>
            </td>
          </tr></tbody>
        </table></div>
        <div class="empty" v-if="!fidLista.length">Nenhum cliente com esse filtro.</div>
      </div>
      <div class="card">
        <h2>Extrato do programa</h2>
        <div class="list" v-if="fidExtrato.length">
          <div class="it" v-for="e in fidExtrato" :key="e.k">
            <div class="grow"><div class="t">{{ e.cliente }}</div><div class="d">{{ e.tipo }}, {{ dShort(e.data) }}</div></div>
            <b class="num" style="font-size:17px" :class="e.sinal==='+'?'pos':''">{{ e.sinal }} {{ brl(e.valor) }}</b>
          </div>
        </div>
        <div class="empty" v-else>Nenhuma movimentação ainda.</div>
        <p class="muted" style="font-size:13px;margin-bottom:0">“Avisar” abre o WhatsApp do cliente lembrando do vale ou cashback disponível.</p>
      </div>
    </div>
  </section>
</template>
