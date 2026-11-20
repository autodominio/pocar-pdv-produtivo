<!-- Detalhe de uma venda, com devolução, troca e cancelamento. -->
<script setup>
import { useSessionStore } from '@/stores/session';
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { PAY_LABEL, FORMAS_ESTORNO } from '@/domain/constants';
import { brl, dtShort } from '@/domain/utils';
import { nomeCompleto } from '@/domain/clients';
import { useVendasStore } from '@/stores/vendas';

const vendas = useVendasStore();
const { venda, vendaCliente, vendaItens } = storeToRefs(vendas);
const { fecharVenda, openDevolucao, openCancelamento, abrirVenda } = vendas;
const temDevolvivel = computed(() => vendaItens.value.some(i => i.disponivel > 0));
const podeCancelar = computed(() => venda.value && venda.value.status !== 'cancelada' && !(venda.value.devolucoes || []).length);
const session = useSessionStore();
</script>

<template>
  <div class="ov" v-if="venda" @click.self="fecharVenda">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="vd-t" style="width:min(660px,100%)">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><h3 id="vd-t">Venda #{{ venda.id }}</h3>
          <div class="muted" style="font-size:14px">{{ dtShort(venda.data) }}{{ venda.registradoPor ? ', registrada por ' + venda.registradoPor : '' }}</div>
          <div class="muted" style="font-size:14px">Cliente: {{ vendaCliente ? nomeCompleto(vendaCliente) : 'não identificado' }}</div></div>
        <span class="tag neg" v-if="venda.status==='cancelada'">Cancelada</span>
        <span class="tag warn" v-else-if="(venda.devolucoes||[]).length">Com devolução</span>
        <span class="tag pos" v-else>Concluída</span>
      </div>

      <div class="scroll-x"><table>
        <thead><tr><th>Peça</th><th class="r">Qtd</th><th class="r">Devolvida</th><th class="r">Valor</th></tr></thead>
        <tbody><tr v-for="i in vendaItens" :key="i.sku"><td>{{ i.nome }} <span class="muted">({{ i.tam }}, {{ i.cor }})</span></td><td class="r">{{ i.qtd }}</td><td class="r">{{ i.devolvido || '—' }}</td><td class="r num" style="font-size:15px">{{ brl(i.preco * i.qtd) }}</td></tr></tbody>
      </table></div>

      <div class="receipt">
        <div class="row" style="justify-content:space-between"><span class="muted">Subtotal</span><span class="num">{{ brl(venda.subtotal) }}</span></div>
        <div class="row" style="justify-content:space-between" v-if="venda.desconto"><span class="muted">Desconto</span><span class="num">− {{ brl(venda.desconto) }}</span></div>
        <div class="row" style="justify-content:space-between" v-if="venda.valeUsado"><span class="muted">Vale-compras</span><span class="num">− {{ brl(venda.valeUsado) }}</span></div>
        <div class="row" style="justify-content:space-between" v-if="venda.cashbackUsado"><span class="muted">Cashback</span><span class="num">− {{ brl(venda.cashbackUsado) }}</span></div>
        <div class="row" style="justify-content:space-between" v-if="venda.creditoTroca"><span class="muted">Crédito da troca</span><span class="num">− {{ brl(venda.creditoTroca) }}</span></div>
        <div class="row" style="justify-content:space-between;font-weight:700"><span>Pago ({{ PAY_LABEL[venda.pagamento] }}{{ venda.parcelas > 1 ? ' ' + venda.parcelas + 'x' : '' }})</span><span class="num" style="font-size:20px">{{ brl(venda.total) }}</span></div>
      </div>

      <div class="row" v-if="venda.trocaDe"><span class="muted" style="font-size:14px">Esta venda é a troca de peças da venda</span><button class="btn sm" @click="abrirVenda(venda.trocaDe)">#{{ venda.trocaDe }}</button></div>

      <div class="fid-box" v-if="venda.status==='cancelada'" style="font-size:14px;border-color:var(--neg)">
        <div><b>Cancelada</b> em {{ dtShort(venda.canceladaEm) }} por {{ venda.canceladaPor }}.</div>
        <div>Motivo: {{ venda.motivoCancelamento }}</div>
        <div v-if="venda.estorno && venda.estorno.valor">Estorno de {{ brl(venda.estorno.valor) }} ({{ FORMAS_ESTORNO[venda.estorno.forma] }}).</div>
      </div>

      <div v-if="(venda.devolucoes||[]).length">
        <div style="font-weight:700;margin-bottom:4px">Devoluções e trocas</div>
        <div class="list">
          <div class="it" v-for="d in venda.devolucoes" :key="d.id">
            <div class="grow"><div class="t">{{ d.itens.map(i => i.qtd + 'x ' + i.nome + ' ' + i.tam).join(', ') }}</div>
              <div class="d">{{ dtShort(d.data) }}, {{ d.usuario }}. {{ d.destino === 'troca' ? 'Trocada por outras peças' : (d.abatido ? 'Abatido ' + brl(d.abatido) + (d.estornado ? ' e devolvido ' + brl(d.estornado) : '') : 'Devolvido em ' + FORMAS_ESTORNO[d.forma].toLowerCase()) }}. {{ d.motivo }}</div></div>
            <b class="num" style="font-size:17px">{{ brl(d.valor) }}</b>
          </div>
        </div>
      </div>

      <div class="acts">
        <button class="btn" style="color:var(--neg)" v-if="podeCancelar && session.pode('caixa')" @click="openCancelamento">Cancelar venda</button>
        <button class="btn" v-if="venda.status!=='cancelada' && temDevolvivel && session.pode('caixa')" @click="openDevolucao">Devolver ou trocar peças</button>
        <button class="btn primary" @click="fecharVenda">Fechar</button>
      </div>
    </div>
  </div>
</template>
