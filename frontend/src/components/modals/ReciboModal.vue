<!-- Recibo da venda concluída. -->
<script setup>
import { storeToRefs } from 'pinia';
import { PAY_LABEL } from '@/domain/constants';
import { brl, curMonth, dShort, monthName, pct } from '@/domain/utils';
import { useGoalsStore } from '@/stores/goals';
import { usePdvStore } from '@/stores/pdv';

const { meta } = storeToRefs(useGoalsStore());
const { recibo, reciboAnim } = storeToRefs(usePdvStore());
const { novaVenda } = usePdvStore();
</script>

<template>
  <div class="ov" v-if="recibo" @click.self="novaVenda">
    <div class="modal" role="dialog" aria-modal="true">
      <div class="row" style="justify-content:space-between"><h3>Venda #{{ recibo.id }} concluída</h3><span class="tag pos">{{ recibo.total > 0 ? PAY_LABEL[recibo.pagamento] + (recibo.parcelas>1?' '+recibo.parcelas+'x':'') : 'Coberta pelo crédito' }}</span></div>
      <div class="muted" v-if="recibo.clienteNome" style="margin-top:-8px">Cliente: <b style="color:var(--ink)">{{ recibo.clienteNome }}</b></div>
      <div class="receipt">
        <div v-for="it in recibo.itens" :key="it.sku" class="row" style="justify-content:space-between;flex-wrap:nowrap"><span>{{ it.qtd }}x {{ it.nome }} ({{ it.tam }}, {{ it.cor }})</span><span class="num">{{ brl(it.preco*it.qtd) }}</span></div>
        <div class="row" style="justify-content:space-between" v-if="recibo.desconto"><span class="muted">Desconto</span><span class="num">− {{ brl(recibo.desconto) }}</span></div>
        <div class="row" style="justify-content:space-between" v-if="recibo.valeUsado"><span class="muted">Vale-compras</span><span class="num">− {{ brl(recibo.valeUsado) }}</span></div>
        <div class="row" style="justify-content:space-between" v-if="recibo.cashbackUsado"><span class="muted">Cashback</span><span class="num">− {{ brl(recibo.cashbackUsado) }}</span></div>
        <div class="row" style="justify-content:space-between" v-if="recibo.creditoTroca"><span class="muted">Crédito da troca (venda #{{ recibo.trocaDe }})</span><span class="num">− {{ brl(recibo.creditoTroca) }}</span></div>
        <div class="row" style="justify-content:space-between" v-if="recibo.sobra"><span class="muted">Sobra da troca {{ recibo.sobra.vale ? 'em vale-troca' : 'devolvida' }}</span><span class="num">{{ brl(recibo.sobra.valor) }}</span></div>
        <div class="row" style="justify-content:space-between;font-weight:700"><span>Total</span><span class="num" style="font-size:20px">{{ brl(recibo.total) }}</span></div>
        <div class="row" style="justify-content:space-between" v-if="recibo.troco"><span class="muted">Troco</span><span class="num">{{ brl(recibo.troco) }}</span></div>
      </div>
      <div class="fid-box" v-if="recibo.cred" style="font-size:14px">
        <div><b>Crediário</b>: {{ recibo.cred.entrada>0 ? 'entrada de ' + brl(recibo.cred.entrada) + ' e ' : '' }}{{ recibo.cred.parcelas.length }} parcelas</div>
        <div class="muted" style="font-size:13px">{{ recibo.cred.parcelas.map(p => p.n + 'ª em ' + dShort(p.venc) + ': ' + brl(p.valor)).join('; ') }}</div>
      </div>
      <div class="fid-box" v-if="recibo.ganhos && (recibo.ganhos.cashback || recibo.ganhos.vale)" style="font-size:14px">
        <div v-if="recibo.ganhos.vale"><b>{{ recibo.clienteNome }} ganhou um vale-compras de {{ brl(recibo.ganhos.vale.valor) }}</b>, válido até {{ dShort(recibo.ganhos.vale.validade) }}.</div>
        <div v-if="recibo.ganhos.cashback">Cashback gerado: <b>{{ brl(recibo.ganhos.cashback) }}</b> para a próxima compra, até {{ dShort(recibo.ganhos.cashValidade) }}.</div>
      </div>
      <div style="display:grid;gap:8px">
        <div class="row" style="justify-content:space-between"><b>Meta de {{ monthName(curMonth) }}</b><span class="num" style="font-size:20px;font-weight:700">{{ pct(meta.pct) }}</span></div>
        <div class="stripe big" style="height:22px"><div class="fill" :style="{width:Math.min(100,(reciboAnim?meta.pct:recibo.pctAntes)*100)+'%'}"></div></div>
        <div class="muted" style="font-size:14px">{{ !meta.alvo ? 'Defina a meta do mês na tela Metas para acompanhar aqui.' : meta.falta>0 ? 'Faltam '+brl(meta.falta)+' para bater a meta do mês.' : 'Meta do mês batida. Tudo que entrar agora é extra.' }}</div>
      </div>
      <div class="muted" style="font-size:13px">Estoque baixado ({{ recibo.itens.reduce((s,i)=>s+i.qtd,0) }} peças) e {{ recibo.lancs }} lançamento(s) gerado(s) no financeiro.</div>
      <div class="acts"><button class="btn primary" @click="novaVenda">Nova venda</button></div>
    </div>
  </div>
</template>
