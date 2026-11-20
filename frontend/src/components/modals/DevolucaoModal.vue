<!-- Devolução de peças: troca por outros produtos no PDV ou devolução do dinheiro. -->
<script setup>
import { storeToRefs } from 'pinia';
import { MOTIVOS_DEVOLUCAO, FORMAS_ESTORNO } from '@/domain/constants';
import { brl } from '@/domain/utils';
import { useVendasStore } from '@/stores/vendas';

const vendas = useVendasStore();
const { venda, vendaItens, devol, devPrevia, devErro } = storeToRefs(vendas);
const { confirmarDevolucao } = vendas;
const mudar = (i, d) => { devol.value.qtds[i.sku] = Math.max(0, Math.min(i.disponivel, (devol.value.qtds[i.sku] || 0) + d)); };
</script>

<template>
  <div class="ov" v-if="devol.open && venda" @click.self="devol.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dv-t" style="width:min(600px,100%)">
      <div><h3 id="dv-t">Devolver ou trocar peças</h3><div class="muted" style="font-size:14px">Venda #{{ venda.id }}. Marque as peças que o cliente está trazendo de volta.</div></div>
      <div class="list">
        <div class="it" v-for="i in vendaItens" :key="i.sku">
          <div class="grow"><div class="t">{{ i.nome }} <span class="muted">({{ i.tam }}, {{ i.cor }})</span></div><div class="d">Vendida{{ i.qtd > 1 ? 's' : '' }}: {{ i.qtd }}{{ i.devolvido ? ', já devolvida' + (i.devolvido > 1 ? 's' : '') + ': ' + i.devolvido : '' }}</div></div>
          <div class="qty" v-if="i.disponivel > 0"><button @click="mudar(i,-1)" aria-label="Diminuir">−</button><span>{{ devol.qtds[i.sku] || 0 }}</span><button @click="mudar(i,1)" :disabled="(devol.qtds[i.sku]||0) >= i.disponivel" aria-label="Aumentar">+</button></div>
          <span class="tag" v-else>Já devolvida</span>
        </div>
      </div>
      <div class="grid g-2" style="gap:12px">
        <label class="f">Motivo<select class="select" v-model="devol.motivo"><option v-for="m in MOTIVOS_DEVOLUCAO" :key="m">{{ m }}</option></select></label>
        <label class="f">Detalhes{{ devol.motivo === 'Outro' ? '' : ' (opcional)' }}<input class="input" v-model="devol.obs"></label>
      </div>
      <div><div class="muted" style="font-size:13px;margin-bottom:6px">O que o cliente quer?</div>
        <div class="paygrid" style="grid-template-columns:1fr 1fr">
          <button :class="{on:devol.destino==='troca'}" @click="devol.destino='troca'">Trocar por outras peças</button>
          <button :class="{on:devol.destino==='estorno'}" @click="devol.destino='estorno'">Devolver o dinheiro</button>
        </div></div>
      <div v-if="devol.destino==='estorno'">
        <div class="paygrid" style="grid-template-columns:repeat(3,1fr)"><button v-for="(l,k) in FORMAS_ESTORNO" :key="k" :class="{on:devol.forma===k}" @click="devol.forma=k">{{ l }}</button></div>
        <div class="muted" style="font-size:12.5px;margin-top:6px" v-if="venda.pagamento==='crediario'">Venda no crediário: o valor é abatido primeiro das parcelas em aberto. Só o que passar disso volta em {{ FORMAS_ESTORNO[devol.forma].toLowerCase() }}.</div>
        <div class="muted" style="font-size:12.5px;margin-top:6px" v-else-if="venda.pagamento==='credito' && devol.forma==='cartao'">Estorno no cartão: as parcelas que a maquininha ainda não pagou à loja são reduzidas primeiro. Faça o estorno também na maquininha.</div>
        <div class="muted" style="font-size:12.5px;margin-top:6px" v-else-if="devol.forma==='cartao'">Faça o estorno também na maquininha.</div>
      </div>
      <div class="muted" style="font-size:12.5px" v-else>As peças voltam ao estoque e o valor vira crédito no PDV para os novos produtos. Se sobrar, vira vale-troca ou volta em dinheiro.</div>
      <div class="receipt" v-if="devPrevia && devPrevia.itens.length">
        <div class="row" style="justify-content:space-between"><span class="muted">Peças voltando ao estoque</span><span class="num">{{ devPrevia.pecas }}</span></div>
        <div class="row" style="justify-content:space-between;font-weight:700"><span>{{ devol.destino === 'troca' ? 'Crédito para a troca' : 'Valor da devolução' }}</span><span class="num" style="font-size:20px">{{ brl(devPrevia.valor) }}</span></div>
        <div class="muted" style="font-size:12px">O valor considera o que o cliente pagou, com descontos e benefícios rateados entre as peças.</div>
      </div>
      <div class="tag neg" v-if="devErro && devPrevia && devPrevia.itens.length">{{ devErro }}</div>
      <div class="acts"><button class="btn" @click="devol.open=false">Voltar</button><button class="btn primary" :disabled="!!devErro" @click="confirmarDevolucao">{{ devol.destino === 'troca' ? 'Escolher as novas peças no PDV' : 'Confirmar devolução' }}</button></div>
    </div>
  </div>
</template>
