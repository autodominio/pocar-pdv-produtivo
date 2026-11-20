<!-- Tela: Crediário. -->
<script setup>
import { storeToRefs } from 'pinia';
import { nomeCompleto } from '@/domain/clients';
import { brl, brl0, curMonth, dShort, monthName, todayIso } from '@/domain/utils';
import { useClientsStore } from '@/stores/clients';
import { useCreditStore } from '@/stores/credit';

const { cliDet } = storeToRefs(useClientsStore());
const { credq, credLista, credKpi, credClientes } = storeToRefs(useCreditStore());
const { waCobranca, openReceber, openCredRegras } = useCreditStore();
</script>

<template>
  <section class="content">
    <div class="row" style="justify-content:space-between"><div class="muted">Vendas parceladas direto com a loja: parcelas, cobrança e recebimento.</div><button class="btn" @click="openCredRegras">Regras do crediário</button></div>
    <div class="grid g-4">
      <div class="card kpi"><div class="k">A receber</div><div class="v">{{ brl0(credKpi.carteira) }}</div><div class="s">{{ credKpi.parcelasAbertas }} parcelas em aberto</div></div>
      <div class="card kpi"><div class="k">Em atraso</div><div class="v" :class="credKpi.atraso>0?'neg':''">{{ brl0(credKpi.atraso) }}</div><div class="s">{{ credKpi.atrasoQtd }} parcelas de {{ credKpi.clientesAtraso }} clientes</div></div>
      <div class="card kpi"><div class="k">Vence nos próximos 7 dias</div><div class="v">{{ brl0(credKpi.semana) }}</div><div class="s">{{ credKpi.semanaQtd }} parcelas</div></div>
      <div class="card kpi"><div class="k">Recebido em {{ monthName(curMonth) }}</div><div class="v pos">{{ brl0(credKpi.recebidoMes) }}</div><div class="s">Inclui {{ brl(credKpi.encargosMes) }} de juros e multa</div></div>
    </div>
    <div class="grid g-main g-cli">
      <div class="card">
        <h2>Parcelas</h2>
        <div class="row" style="margin-bottom:12px"><input class="input" v-model="credq.busca" placeholder="Buscar por cliente, telefone ou nº da venda" style="flex:1;min-width:180px" aria-label="Buscar parcela"></div>
        <div class="chips" style="margin-bottom:12px">
          <button class="chip" :class="{on:credq.filtro==='atraso'}" @click="credq.filtro='atraso'">Em atraso ({{ credKpi.atrasoQtd }})</button>
          <button class="chip" :class="{on:credq.filtro==='semana'}" @click="credq.filtro='semana'">Vencem em 7 dias</button>
          <button class="chip" :class="{on:credq.filtro==='aberto'}" @click="credq.filtro='aberto'">Todas em aberto</button>
          <button class="chip" :class="{on:credq.filtro==='pagas'}" @click="credq.filtro='pagas'">Recebidas no mês</button>
        </div>
        <div class="scroll-x"><table>
          <thead><tr><th>Cliente</th><th>Venda</th><th>Parcela</th><th>Vencimento</th><th class="r">Valor</th><th>Situação</th><th></th></tr></thead>
          <tbody><tr v-for="x in credLista" :key="x.key">
            <td style="white-space:nowrap"><b>{{ x.nome }}</b></td>
            <td class="muted">#{{ x.cr.vendaId }}</td>
            <td class="num" style="font-size:15px">{{ x.p.n }}/{{ x.qtd }}</td>
            <td style="white-space:nowrap">{{ dShort(x.p.venc) }}/{{ x.p.venc.slice(2,4) }}</td>
            <td class="r num" style="font-size:16px">{{ brl(x.p.pagoEm ? x.p.valorPago : x.p.valor) }}</td>
            <td style="white-space:nowrap">
              <span class="tag pos" v-if="x.p.pagoEm">Recebida {{ dShort(x.p.pagoEm) }}</span>
              <span class="tag neg" v-else-if="x.atraso>0">{{ x.atraso }} {{ x.atraso===1?'dia':'dias' }} de atraso</span>
              <span class="tag warn" v-else-if="x.p.venc===todayIso">Vence hoje</span>
              <span class="tag" v-else>Em aberto</span>
            </td>
            <td style="white-space:nowrap;text-align:right">
              <template v-if="!x.p.pagoEm">
                <a class="btn sm" v-if="x.c" :href="waCobranca(x)" target="_blank" rel="noopener">Lembrar</a>
                <button class="btn sm primary" @click="openReceber(x.cr.id, x.p.n)">Receber</button>
              </template>
            </td>
          </tr></tbody>
        </table></div>
        <div class="empty" v-if="!credLista.length">{{ credq.filtro==='atraso' ? 'Nenhuma parcela em atraso.' : 'Nenhuma parcela com esse filtro.' }}</div>
      </div>
      <div class="card">
        <h2>Clientes no crediário</h2>
        <div class="list" v-if="credClientes.length">
          <button class="it" v-for="x in credClientes" :key="x.c.id" @click="cliDet=x.c" style="background:none;border:none;border-bottom:1px solid var(--line);text-align:left;width:100%;padding:10px 0">
            <div class="grow"><div class="t">{{ nomeCompleto(x.c) }}</div><div class="d">{{ brl(x.emAberto) }} em aberto de {{ brl0(x.limite) }}</div><div class="bar-h" style="margin-top:5px"><i :style="{width:Math.min(100,x.emAberto/(x.limite||1)*100)+'%'}"></i></div></div>
            <span class="tag neg" v-if="x.atrasoDesde">Atraso</span>
          </button>
        </div>
        <div class="empty" v-else>Nenhum cliente com parcelas em aberto.</div>
        <p class="muted" style="font-size:13px;margin-bottom:0">O limite de cada cliente fica no cadastro dele. Quem tem parcela atrasada não consegue comprar de novo no crediário até regularizar.</p>
      </div>
    </div>
  </section>
</template>
