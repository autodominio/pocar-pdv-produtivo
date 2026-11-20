<!-- Ficha do cliente. -->
<script setup>
import { storeToRefs } from 'pinia';
import { anivHoje, anivMes, dLong, fone, idade, nomeCompleto, waLink } from '@/domain/clients';
import { PAY_LABEL } from '@/domain/constants';
import { brl, brl0, dShort, dtShort } from '@/domain/utils';
import { useClientsStore } from '@/stores/clients';
import { useCreditStore } from '@/stores/credit';
import { useDbStore } from '@/stores/db';
import { useLoyaltyStore } from '@/stores/loyalty';
import { useVendasStore } from '@/stores/vendas';

const { cliDet, cliHistorico } = storeToRefs(useClientsStore());
const { statOf, openCliente } = useClientsStore();
const { detCred } = storeToRefs(useCreditStore());
const { state } = storeToRefs(useDbStore());
const { detBenef } = storeToRefs(useLoyaltyStore());
const { abrirVenda } = useVendasStore();
</script>

<template>
  <div class="ov" v-if="cliDet" @click.self="cliDet=null">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cd-t" style="width:min(620px,100%)">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><h3 id="cd-t">{{ nomeCompleto(cliDet) }}</h3><div class="muted" style="font-size:14px">{{ fone(cliDet.telefone) }}, {{ idade(cliDet.nascimento) }} anos, aniversário em {{ dLong(cliDet.nascimento) }}</div><div class="muted" style="font-size:13px">Cliente desde {{ dShort(cliDet.criadoEm) }}/{{ cliDet.criadoEm.slice(0,4) }}</div></div>
        <span class="tag y" v-if="anivMes(cliDet)">{{ anivHoje(cliDet) ? 'Aniversário hoje' : 'Aniversariante do mês' }}</span>
      </div>
      <div class="grid g-3" style="gap:10px">
        <div class="receipt"><span class="muted" style="font-size:13px">Compras</span><b class="num" style="font-size:24px">{{ statOf(cliDet).qtd }}</b></div>
        <div class="receipt"><span class="muted" style="font-size:13px">Total gasto</span><b class="num" style="font-size:24px">{{ brl(statOf(cliDet).total) }}</b></div>
        <div class="receipt"><span class="muted" style="font-size:13px">Ticket médio</span><b class="num" style="font-size:24px">{{ brl(statOf(cliDet).qtd ? statOf(cliDet).total / statOf(cliDet).qtd : 0) }}</b></div>
      </div>
      <div class="row" style="justify-content:space-between;font-size:14px" v-if="detCred"><span><b>Crediário:</b> {{ brl(detCred.emAberto) }} em aberto, limite de {{ brl0(detCred.limite) }}</span><span class="tag neg" v-if="detCred.atrasoDesde">Atraso desde {{ dShort(detCred.atrasoDesde) }}</span></div>
      <div class="fid-box" v-if="detBenef">
        <div class="row" style="justify-content:space-between"><b>Fidelidade</b><span class="muted" style="font-size:13px" v-if="state.fid.valeAtivo && detBenef.ciclo.fim">Ciclo atual até {{ dShort(detBenef.ciclo.fim) }}</span></div>
        <div v-if="state.fid.valeAtivo" style="font-size:13px">
          <div class="row" style="justify-content:space-between"><span>{{ brl(detBenef.ciclo.acumulado) }} de {{ brl0(state.fid.valeMeta) }} para o próximo vale</span><span class="muted">faltam {{ brl(Math.max(0, state.fid.valeMeta - detBenef.ciclo.acumulado)) }}</span></div>
          <div class="bar-h y" style="margin-top:4px"><i :style="{width:Math.min(100,detBenef.ciclo.acumulado/state.fid.valeMeta*100)+'%'}"></i></div>
        </div>
        <div class="row" style="gap:6px">
          <span class="tag y" v-for="v in detBenef.vales" :key="v.id">Vale {{ brl0(v.valor) }} até {{ dShort(v.validade) }}</span>
          <span class="tag pos" v-if="detBenef.cashSaldo>0">Cashback {{ brl(detBenef.cashSaldo) }} até {{ dShort(detBenef.cashValidade) }}</span>
          <span class="muted" style="font-size:13px" v-if="!detBenef.vales.length && !(detBenef.cashSaldo>0)">Sem vale ou cashback disponível agora.</span>
        </div>
      </div>
      <div>
        <div style="font-weight:700;margin-bottom:4px">Histórico de compras</div>
        <div class="list" v-if="cliHistorico.length">
          <div class="it" v-for="s in cliHistorico.slice(0,8)" :key="s.id" @click="abrirVenda(s.id)" style="cursor:pointer" title="Ver a venda">
            <div class="grow"><div class="t">Venda #{{ s.id }}, {{ dtShort(s.data) }}</div><div class="d">{{ s.itens.map(i => i.qtd + 'x ' + i.nome + ' ' + i.tam).join('; ') }}</div></div>
            <span class="tag neg" v-if="s.status==='cancelada'">Cancelada</span><span class="tag" v-else>{{ PAY_LABEL[s.pagamento] }}</span>
            <b class="num" style="font-size:17px">{{ brl(s.total) }}</b>
          </div>
        </div>
        <div class="empty" v-else>Ainda não comprou. Selecione este cliente no PDV para registrar a próxima compra.</div>
      </div>
      <div class="acts"><a class="btn" :href="waLink(cliDet,false)" target="_blank" rel="noopener">Abrir WhatsApp</a><button class="btn" @click="openCliente(cliDet,false)">Editar cadastro</button><button class="btn primary" @click="cliDet=null">Fechar</button></div>
    </div>
  </div>
</template>
