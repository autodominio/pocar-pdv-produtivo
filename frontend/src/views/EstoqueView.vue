<!-- Tela: Estoque. -->
<script setup>
import { storeToRefs } from 'pinia';
import { icons } from '@/domain/icons';
import { coresOf, qClass, qtyAt, statusOf, stockOf, tamsOf } from '@/domain/products';
import { brl, brl0, colorOf, dtShort, pct } from '@/domain/utils';
import { useCatalogStore } from '@/stores/catalog';
import { useEtiquetasStore } from '@/stores/etiquetas';

const { categorias, lowStock, estq, est, estProdutos, movsRecentes } = storeToRefs(useCatalogStore());
const { toggleExp, vendidas30, openEntrada, openNovo, openEdicao } = useCatalogStore();
const { openEtiquetas } = useEtiquetasStore();
</script>

<template>
  <section class="content">
    <div class="grid g-4">
      <div class="card kpi"><div class="k">Peças em estoque</div><div class="v">{{ est.pecas }}</div><div class="s">{{ est.skus }} variações cadastradas</div></div>
      <div class="card kpi"><div class="k">Valor a custo</div><div class="v">{{ brl0(est.custo) }}</div><div class="s">Capital parado no estoque</div></div>
      <div class="card kpi"><div class="k">Valor de venda</div><div class="v">{{ brl0(est.venda) }}</div><div class="s">Margem potencial {{ pct(1-est.custo/est.venda) }}</div></div>
      <div class="card kpi"><div class="k">Abaixo do mínimo</div><div class="v" :class="lowStock.length?'neg':''">{{ lowStock.length }}</div><div class="s">{{ lowStock.filter(v=>v.qtd===0).length }} zeradas</div></div>
    </div>
    <div class="card">
      <div class="row" style="margin-bottom:14px">
        <input class="input" v-model="estq.busca" placeholder="Buscar produto ou código" style="flex:1;min-width:180px" aria-label="Buscar no estoque">
        <select class="select" v-model="estq.cat" aria-label="Categoria"><option value="">Todas as categorias</option><option v-for="c in categorias" :key="c">{{ c }}</option></select>
        <label class="row" style="gap:6px;font-size:14px"><input type="checkbox" v-model="estq.soBaixo"> Só estoque baixo</label>
        <button class="btn" @click="openEtiquetas()"><span v-html="icons.tag"></span>Etiquetas</button>
        <button class="btn" @click="openEntrada()"><span v-html="icons.plus"></span>Entrada de mercadoria</button>
        <button class="btn primary" @click="openNovo"><span v-html="icons.plus"></span>Novo produto</button>
      </div>
      <div class="scroll-x">
        <table>
          <thead><tr><th>Produto</th><th>Categoria</th><th class="r">Custo</th><th class="r">Preço</th><th class="r">Margem</th><th class="r">Estoque</th><th>Situação</th></tr></thead>
          <tbody>
            <template v-for="p in estProdutos" :key="p.id">
              <tr class="click" @click="toggleExp(p.id)" :aria-expanded="estq.exp===p.id">
                <td><b>{{ p.nome }}</b><div class="muted" style="font-size:12px">{{ p.id }}, {{ p.variantes.length }} {{ p.variantes.length === 1 ? 'variação' : 'variações' }}</div></td>
                <td>{{ p.categoria }}</td>
                <td class="r num">{{ brl(p.custo) }}</td>
                <td class="r num">{{ brl(p.preco) }}</td>
                <td class="r num">{{ pct(1-p.custo/p.preco) }}</td>
                <td class="r num" style="font-size:17px;font-weight:700">{{ stockOf(p) }}</td>
                <td><span class="tag" :class="statusOf(p).cls">{{ statusOf(p).label }}</span></td>
              </tr>
              <tr v-if="estq.exp===p.id">
                <td colspan="7" style="background:var(--surface-2)">
                  <div class="row" style="align-items:flex-start;gap:28px">
                    <table class="matrix" style="width:auto">
                      <thead><tr><th>Cor / tamanho</th><th v-for="t in tamsOf(p)" :key="t">{{ t }}</th></tr></thead>
                      <tbody><tr v-for="c in coresOf(p)" :key="c"><td><span class="swatch" :style="{background:colorOf(c)}"></span> {{ c }}</td>
                        <td v-for="t in tamsOf(p)" :key="t"><span class="q-cell" :class="qClass(p,t,c)">{{ qtyAt(p,t,c) }}</span></td></tr></tbody>
                    </table>
                    <div style="display:grid;gap:8px;font-size:14px">
                      <div class="muted">Estoque mínimo por variação: {{ new Set(p.variantes.map(v => v.min)).size === 1 ? p.variantes[0].min + ' peças' : 'varia por variação' }}</div>
                      <div class="muted">Vendidas nos últimos 30 dias: <b style="color:var(--ink)">{{ vendidas30(p.id) }}</b></div>
                      <div class="row" style="gap:6px"><button class="btn sm primary" @click.stop="openEdicao(p.id)">Editar produto</button><button class="btn sm" @click.stop="openEntrada(p.id)">Lançar entrada deste produto</button><button class="btn sm" @click.stop="openEtiquetas(p.id)">Etiquetas deste produto</button></div>
                      <table class="codigos">
                        <thead><tr><th>Variação</th><th>Código (SKU)</th><th>Código de barras</th></tr></thead>
                        <tbody><tr v-for="v in p.variantes" :key="v.sku"><td>{{ v.tam === 'Único' ? v.cor : v.tam + ', ' + v.cor }}</td><td class="num">{{ v.sku }}</td><td class="num">{{ v.codigoBarras }}</td></tr></tbody>
                      </table>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        <div class="empty" v-if="!estProdutos.length">Nenhum produto com esses filtros.</div>
      </div>
    </div>
    <div class="card">
      <h2>Últimas movimentações</h2>
      <div class="scroll-x"><table>
        <thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Variação</th><th class="r">Qtd</th><th>Origem</th></tr></thead>
        <tbody><tr v-for="m in movsRecentes" :key="m.id"><td>{{ dtShort(m.data) }}</td><td><span class="tag" :class="m.tipo==='entrada'?'pos':''">{{ m.tipo==='entrada'?'Entrada':'Saída' }}</span></td><td>{{ m.nome }}</td><td>{{ m.var }}</td><td class="r num" style="font-size:16px">{{ m.tipo==='entrada'?'+':'−' }}{{ m.qtd }}</td><td class="muted">{{ m.origem }}</td></tr></tbody>
      </table></div>
    </div>
  </section>
</template>

<style scoped>
.codigos{width:auto;font-size:12.5px}
.codigos th,.codigos td{padding:4px 10px 4px 0;border-bottom:1px solid var(--line);text-align:left}
.codigos td.num{font-size:13.5px;letter-spacing:.02em}
</style>
