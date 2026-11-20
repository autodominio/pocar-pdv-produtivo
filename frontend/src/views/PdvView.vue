<!-- Tela: PDV. -->
<script setup>
import CampoData from '@/components/form/CampoData.vue';
import { ref, watch, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { anivHoje, anivMes, fone, nomeCompleto } from '@/domain/clients';
import { PAY_LABEL } from '@/domain/constants';
import { coresOf, stockOf } from '@/domain/products';
import { brl, brl0, colorOf, dShort, pct, todayIso } from '@/domain/utils';
import { useCatalogStore } from '@/stores/catalog';
import { useClientsStore } from '@/stores/clients';
import { useDbStore } from '@/stores/db';
import { useGoalsStore } from '@/stores/goals';
import { usePdvStore } from '@/stores/pdv';
import { useCaixaStore } from '@/stores/caixa';

const { categorias } = storeToRefs(useCatalogStore());
const { variantOf } = useCatalogStore();
const { openCliente } = useClientsStore();
const { state } = storeToRefs(useDbStore());
const { meta } = storeToRefs(useGoalsStore());
const { pdv, pdvCliente, cliMatches, pdvBenef, credPdvCli, pdvProdutos, cartSub, cartPecas, cartDesc, cartVale, valeSobra, cartCash, cartTroca, trocaSobra, cartTotal, credPlano, pdvErro } = storeToRefs(usePdvStore());
const { selCliente, openPicker, addBySku, changeQty, removeItem, finalizar, cancelarTroca } = usePdvStore();
const { atual: caixaAtual } = storeToRefs(useCaixaStore());
const { openAbrir } = useCaixaStore();

// A busca recebe o foco de volta a cada "Nova venda".
const buscaEl = ref(null);
watch(() => usePdvStore().focusTick, () => nextTick(() => buscaEl.value?.focus()));
</script>

<template>
  <section class="content">
    <div class="pdv">
      <div class="grid" style="gap:14px">
        <div class="fid-box" v-if="!caixaAtual" style="border-color:var(--warn);background:var(--warn-bg)">
          <div class="row" style="justify-content:space-between"><div><b>Caixa fechado.</b> <span class="muted">Abra o caixa para começar a vender.</span></div><button class="btn primary" @click="openAbrir">Abrir caixa</button></div>
        </div>
        <div class="row">
          <input class="input" style="flex:1;min-width:200px" v-model="pdv.busca" ref="buscaEl" placeholder="Buscar produto ou bipar código" @keydown.enter="addBySku" aria-label="Buscar produto">
        </div>
        <div class="chips">
          <button class="chip" :class="{on:pdv.cat===''}" @click="pdv.cat=''">Todos</button>
          <button class="chip" v-for="c in categorias" :key="c" :class="{on:pdv.cat===c}" @click="pdv.cat=c">{{ c }}</button>
        </div>
        <div class="pgrid">
          <button class="pcard" v-for="p in pdvProdutos" :key="p.id" :class="{out:stockOf(p)===0}" @click="openPicker(p)">
            <span class="cat">{{ p.categoria }}</span>
            <span class="nm">{{ p.nome }}</span>
            <span class="pr">{{ brl(p.preco) }}</span>
            <span class="st"><span>{{ stockOf(p) }} em estoque</span><span><span v-for="c in coresOf(p)" :key="c" class="swatch" :style="{background:colorOf(c),marginLeft:'3px'}" :title="c"></span></span></span>
          </button>
        </div>
        <div class="empty" v-if="!pdvProdutos.length">Nenhum produto encontrado para “{{ pdv.busca }}”.</div>
      </div>

      <aside class="card cart" aria-label="Venda atual">
        <div class="row" style="justify-content:space-between"><h2 style="margin:0">Venda #{{ state.nextSale }}</h2><button class="btn sm ghost" v-if="pdv.cart.length" @click="pdv.cart=[]">Limpar</button></div>
        <div class="fid-box" v-if="pdv.troca" style="font-size:14px;border-color:var(--ink)">
          <div class="row" style="justify-content:space-between;flex-wrap:nowrap"><b>Troca da venda #{{ pdv.troca.vendaId }}</b><button class="btn sm ghost" @click="cancelarTroca">Cancelar troca</button></div>
          <div class="muted" style="font-size:13px">Voltando: {{ pdv.troca.pecas }}</div>
          <div>Crédito para os novos produtos: <b>{{ brl(pdv.troca.valor) }}</b></div>
          <label class="f" v-if="trocaSobra>0">Sobram {{ brl(trocaSobra) }} do crédito
            <select class="select" v-model="pdv.troca.sobraDestino"><option value="vale" :disabled="!pdvCliente">Vale-troca para o cliente{{ pdvCliente ? '' : ' (identifique o cliente)' }}</option><option value="dinheiro">Devolver em dinheiro</option><option value="pix">Devolver no Pix</option></select>
          </label>
        </div>
        <div class="items">
          <div class="ci" v-for="it in pdv.cart" :key="it.sku">
            <div><div class="nm">{{ it.nome }}</div><div class="vr">{{ it.tam }}, {{ it.cor }}, {{ brl(it.preco) }} cada</div></div>
            <b class="num" style="font-size:17px;text-align:right">{{ brl(it.preco*it.qtd) }}</b>
            <div class="qty"><button @click="changeQty(it,-1)" aria-label="Diminuir">−</button><span>{{ it.qtd }}</span><button @click="changeQty(it,1)" :disabled="it.qtd>=variantOf(it.sku).qtd" aria-label="Aumentar">+</button></div>
            <button class="btn sm ghost" style="justify-self:end;color:var(--neg)" @click="removeItem(it)">Remover</button>
          </div>
          <div class="empty" v-if="!pdv.cart.length">Toque num produto para começar a venda.</div>
        </div>
        <div>
          <div class="muted" style="font-size:13px;margin-bottom:5px;font-weight:500">Cliente</div>
          <div v-if="pdvCliente" class="cli-sel">
            <div class="grow"><b>{{ nomeCompleto(pdvCliente) }}</b><div class="muted" style="font-size:13px">{{ fone(pdvCliente.telefone) }} <span v-if="anivMes(pdvCliente)" class="tag y">{{ anivHoje(pdvCliente) ? 'Aniversário hoje' : 'Aniversariante do mês' }}</span></div></div>
            <button class="btn sm ghost" @click="pdv.clienteId=null">Trocar</button>
          </div>
          <div v-else style="position:relative">
            <div class="row" style="gap:6px;flex-wrap:nowrap">
              <input class="input" style="flex:1" v-model="pdv.cliBusca" placeholder="Nome ou telefone (opcional)" aria-label="Buscar cliente da venda">
              <button class="btn sm" @click="openCliente(null,true)">Cadastrar</button>
            </div>
            <div class="cli-drop" v-if="pdv.cliBusca.trim().length>=2">
              <button v-for="c in cliMatches" :key="c.id" @click="selCliente(c)"><b>{{ nomeCompleto(c) }}</b><span class="muted num">{{ fone(c.telefone) }}</span></button>
              <div class="empty" v-if="!cliMatches.length" style="padding:12px">Nenhum cliente encontrado. <button class="btn sm" @click="openCliente(null,true)">Cadastrar “{{ pdv.cliBusca.trim() }}”</button></div>
            </div>
          </div>
        </div>
        <div class="fid-box" v-if="pdvCliente && pdvBenef">
          <div v-if="pdvBenef.vales.length || pdvBenef.cashSaldo>0" style="display:grid;gap:6px">
            <label class="row" style="gap:8px;flex-wrap:nowrap;font-size:14px" v-for="v in pdvBenef.vales" :key="v.id"><input type="checkbox" :value="v.id" v-model="pdv.valesSel"><span style="flex:1">Usar vale-compras de <b>{{ brl(v.valor) }}</b></span><span class="muted" style="font-size:12px">até {{ dShort(v.validade) }}</span></label>
            <label class="row" style="gap:8px;flex-wrap:nowrap;font-size:14px" v-if="pdvBenef.cashSaldo>0"><input type="checkbox" v-model="pdv.usarCash"><span style="flex:1">Usar cashback de <b>{{ brl(pdvBenef.cashSaldo) }}</b></span><span class="muted" style="font-size:12px">até {{ dShort(pdvBenef.cashValidade) }}</span></label>
          </div>
          <div class="muted" style="font-size:13px" v-else>Sem vale ou cashback disponível no momento.</div>
          <div v-if="state.fid.valeAtivo" style="font-size:13px">
            <div class="row" style="justify-content:space-between"><span class="muted">Rumo ao vale de {{ brl0(state.fid.valeValor) }}</span><span><b>{{ brl(pdvBenef.ciclo.acumulado) }}</b> de {{ brl0(state.fid.valeMeta) }}</span></div>
            <div class="bar-h y" style="margin-top:4px"><i :style="{width:Math.min(100,pdvBenef.ciclo.acumulado/state.fid.valeMeta*100)+'%'}"></i></div>
          </div>
        </div>
        <div class="row" style="flex-wrap:nowrap">
          <label class="f" style="flex:1">Desconto
            <div class="row" style="gap:4px;flex-wrap:nowrap">
              <input class="input" type="number" min="0" step="0.01" v-model.number="pdv.desc" style="width:80px">
              <select class="select" v-model="pdv.descTipo" style="padding:9px 6px"><option>%</option><option>R$</option></select>
            </div>
          </label>
        </div>
        <div class="paygrid" role="group" aria-label="Forma de pagamento">
          <button v-for="(l,k) in PAY_LABEL" :key="k" :class="{on:pdv.pag===k}" @click="pdv.pag=k">{{ l }}</button>
        </div>
        <div class="row" v-if="pdv.pag==='credito'">
          <label class="f" style="flex:1">Parcelas
            <select class="select" v-model.number="pdv.parcelas"><option v-for="n in 6" :key="n" :value="n">{{ n }}x de {{ brl(cartTotal/n) }}{{ n===1?' (à vista)':' sem juros' }}</option></select>
          </label>
        </div>
        <div class="fid-box" v-if="pdv.pag==='crediario'">
          <div v-if="!pdvCliente" class="muted" style="font-size:13px">Selecione o cliente acima para vender no crediário.</div>
          <template v-else>
            <div class="row" style="justify-content:space-between;font-size:13px"><span class="muted">Limite {{ brl0(credPdvCli.limite) }}, em aberto {{ brl(credPdvCli.emAberto) }}</span><b>Disponível {{ brl(credPdvCli.disponivel) }}</b></div>
            <div class="row" style="flex-wrap:nowrap;gap:8px">
              <label class="f" style="flex:1">Entrada (R$)<input class="input" type="number" min="0" step="0.01" v-model.number="pdv.credEntrada"></label>
              <label class="f" style="width:120px" v-if="pdv.credEntrada>0">Entrada em<select class="select" v-model="pdv.credEntradaForma"><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option></select></label>
            </div>
            <div class="row" style="flex-wrap:nowrap;gap:8px">
              <label class="f" style="flex:1">Parcelas<select class="select" v-model.number="pdv.credParcelas"><option v-for="n in state.credCfg.maxParcelas" :key="n" :value="n">{{ n }}x de {{ brl(credPlano.financiado/n) }}</option></select></label>
              <label class="f" style="flex:1">1º vencimento<CampoData :min="todayIso" v-model="pdv.credPrimeiro" /></label>
            </div>
            <div class="muted" style="font-size:12.5px">{{ credPlano.parcelas.map(p => p.n + 'ª em ' + dShort(p.venc) + ': ' + brl(p.valor)).join('; ') }}</div>
          </template>
        </div>
        <div class="row" v-if="pdv.pag==='dinheiro'" style="flex-wrap:nowrap">
          <label class="f" style="flex:1">Valor recebido<input class="input" type="number" min="0" step="0.01" v-model.number="pdv.recebido"></label>
          <div style="text-align:right"><div class="muted" style="font-size:13px">Troco</div><b class="num" style="font-size:22px">{{ brl(Math.max(0,(pdv.recebido||0)-cartTotal)) }}</b></div>
        </div>
        <div class="totals">
          <div class="ln"><span class="muted">Subtotal ({{ cartPecas }} peças)</span><span class="num">{{ brl(cartSub) }}</span></div>
          <div class="ln" v-if="cartDesc>0"><span class="muted">Desconto</span><span class="num neg">− {{ brl(cartDesc) }}</span></div>
          <div class="ln" v-if="cartVale>0"><span class="muted">Vale-compras</span><span class="num neg">− {{ brl(cartVale) }}</span></div>
          <div class="ln" v-if="cartCash>0"><span class="muted">Cashback</span><span class="num neg">− {{ brl(cartCash) }}</span></div>
          <div class="ln" v-if="cartTroca>0"><span class="muted">Crédito da troca</span><span class="num neg">− {{ brl(cartTroca) }}</span></div>
          <div class="ln big"><span>Total</span><span class="num">{{ brl(cartTotal) }}</span></div>
        </div>
        <div class="muted" style="font-size:13px" v-if="valeSobra>0">O vale é maior que a compra: a diferença de {{ brl(valeSobra) }} não volta como troco.</div>
        <div class="muted" style="font-size:13px" v-if="pdv.cart.length && pdvCliente && state.fid.cashAtivo && cartTotal>0">{{ pdvCliente.nome }} ganha {{ brl(cartTotal*state.fid.cashPct/100) }} de cashback com esta compra.</div>
        <div class="muted" style="font-size:13px" v-if="pdv.cart.length && meta.falta>0">Esta venda leva a meta do mês para <b style="color:var(--ink)">{{ pct((meta.realizado+cartTotal)/meta.alvo) }}</b>.</div>
        <div class="tag neg" v-if="pdvErro">{{ pdvErro }}</div>
        <button class="btn primary finish" :disabled="!!pdvErro || !pdv.cart.length" @click="finalizar">Finalizar venda</button>
      </aside>
    </div>
  </section>
</template>
