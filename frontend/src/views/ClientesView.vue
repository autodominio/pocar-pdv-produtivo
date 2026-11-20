<!-- Tela: Clientes. -->
<script setup>
import { storeToRefs } from 'pinia';
import { anivHoje, fone, idade, nomeCompleto, waLink } from '@/domain/clients';
import { icons } from '@/domain/icons';
import { brl, curMonth, dShort, monthName, pct, todayIso } from '@/domain/utils';
import { useClientsStore } from '@/stores/clients';
import { useDbStore } from '@/stores/db';
import { useLoyaltyStore } from '@/stores/loyalty';

const { cliq, clientesFiltrados, aniversariantes, cliKpi, cliDet } = storeToRefs(useClientsStore());
const { statOf, openCliente } = useClientsStore();
const { state } = storeToRefs(useDbStore());
const { benefTotal } = useLoyaltyStore();
</script>

<template>
  <section class="content">
    <div class="grid g-4">
      <div class="card kpi"><div class="k">Clientes cadastrados</div><div class="v">{{ state.clientes.length }}</div><div class="s">{{ cliKpi.novos }} novos em {{ monthName(curMonth) }}</div></div>
      <div class="card kpi"><div class="k">Compraram este mês</div><div class="v">{{ cliKpi.compraram }}</div><div class="s">{{ pct(cliKpi.identificadas) }} das vendas com cliente identificado</div></div>
      <div class="card kpi"><div class="k">Aniversariantes do mês</div><div class="v">{{ aniversariantes.length }}</div><div class="s">{{ cliKpi.anivHoje ? cliKpi.anivHoje + ' fazendo aniversário hoje' : 'Nenhum aniversário hoje' }}</div></div>
      <div class="card kpi"><div class="k">Ticket com cadastro</div><div class="v">{{ brl(cliKpi.ticketCom) }}</div><div class="s">Sem cadastro: {{ brl(cliKpi.ticketSem) }}</div></div>
    </div>
    <div class="grid g-main g-cli">
      <div class="card">
        <div class="row" style="margin-bottom:12px">
          <input class="input" v-model="cliq.busca" placeholder="Buscar por nome ou telefone" style="flex:1;min-width:180px" aria-label="Buscar cliente">
          <button class="btn primary" @click="openCliente(null,false)"><span v-html="icons.plus"></span>Novo cliente</button>
        </div>
        <div class="chips" style="margin-bottom:12px">
          <button class="chip" :class="{on:cliq.filtro===''}" @click="cliq.filtro=''">Todos</button>
          <button class="chip" :class="{on:cliq.filtro==='aniv'}" @click="cliq.filtro='aniv'">Aniversariantes do mês</button>
          <button class="chip" :class="{on:cliq.filtro==='inativos'}" @click="cliq.filtro='inativos'">Sem compra há 60 dias</button>
        </div>
        <div class="scroll-x"><table>
          <thead><tr><th>Cliente</th><th>Telefone</th><th>Aniversário</th><th class="r">Compras</th><th class="r">Total gasto</th><th class="r">Benefícios</th><th>Última compra</th></tr></thead>
          <tbody><tr class="click" v-for="c in clientesFiltrados" :key="c.id" @click="cliDet=c" tabindex="0" @keydown.enter="cliDet=c">
            <td style="white-space:nowrap"><b>{{ nomeCompleto(c) }}</b></td>
            <td class="num" style="font-size:15px;white-space:nowrap">{{ fone(c.telefone) }}</td>
            <td style="white-space:nowrap">{{ dShort(c.nascimento) }} <span class="muted" style="font-size:13px">({{ idade(c.nascimento) }} anos)</span> <span class="tag y" v-if="anivHoje(c)">Hoje</span></td>
            <td class="r num" style="font-size:16px">{{ statOf(c).qtd }}</td>
            <td class="r num" style="font-size:16px">{{ brl(statOf(c).total) }}</td>
            <td class="r num" style="font-size:16px">{{ benefTotal(c) ? brl(benefTotal(c)) : '—' }}</td>
            <td class="muted" style="white-space:nowrap">{{ statOf(c).ultima ? dShort(statOf(c).ultima) + '/' + statOf(c).ultima.slice(2,4) : 'Nunca comprou' }}</td>
          </tr></tbody>
        </table></div>
        <div class="empty" v-if="!clientesFiltrados.length">Nenhum cliente encontrado. <button class="btn sm" @click="openCliente(null,false)">Cadastrar cliente</button></div>
      </div>
      <div class="card">
        <h2>Aniversariantes de {{ monthName(curMonth) }}</h2>
        <div class="list" v-if="aniversariantes.length">
          <div class="it" v-for="c in aniversariantes" :key="c.id">
            <div class="grow"><div class="t">{{ nomeCompleto(c) }}</div><div class="d">Dia {{ +c.nascimento.slice(8) }}, faz {{ +curMonth.slice(0,4) - +c.nascimento.slice(0,4) }} anos</div></div>
            <span class="tag" :class="anivHoje(c)?'y':''" v-if="c.nascimento.slice(5)<=todayIso.slice(5)">{{ anivHoje(c) ? 'Hoje' : 'Já passou' }}</span>
            <a class="btn sm" :href="waLink(c,true)" target="_blank" rel="noopener">Parabenizar</a>
          </div>
        </div>
        <div class="empty" v-else>Nenhum aniversariante este mês.</div>
        <p class="muted" style="font-size:13px;margin-bottom:0">“Parabenizar” abre o WhatsApp do cliente com uma mensagem pronta.</p>
      </div>
    </div>
  </section>
</template>
