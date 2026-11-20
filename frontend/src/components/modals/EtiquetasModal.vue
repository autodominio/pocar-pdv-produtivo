<!-- Gerador de etiquetas com código de barras para as peças. -->
<script setup>
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { FOLHAS, barrasEan13, segmentosBarras, ean13Valido } from '@/domain/etiquetas';
import { brl } from '@/domain/utils';
import { useEtiquetasStore } from '@/stores/etiquetas';

const store = useEtiquetasStore();
const { et, folha, capacidade, produtosFiltrados, etiquetas, folhas, exemplo, erro } = storeToRefs(store);
const { usarEstoque, limpar, gerar } = store;

const CAMPOS = [['nome', 'Nome do produto'], ['variacao', 'Tamanho e cor'], ['preco', 'Preço'], ['sku', 'Código do produto (SKU)'], ['codigoBarras', 'Código de barras'], ['loja', 'Nome da loja']];
const ESCALA = 4; // px por mm na prévia
const barras = computed(() => exemplo.value && ean13Valido(exemplo.value.codigoBarras || '') ? segmentosBarras(barrasEan13(exemplo.value.codigoBarras)) : []);
const qtd = (sku, d) => { et.value.qtds[sku] = Math.max(0, (Number(et.value.qtds[sku]) || 0) + d); };
</script>

<template>
  <div class="ov" v-if="et.open" @click.self="et.open=false">
    <div class="modal etq" role="dialog" aria-modal="true" aria-labelledby="et-t">
      <div><h3 id="et-t">Etiquetas de produtos</h3><div class="muted" style="font-size:14px">Gera um PDF para imprimir na folha de etiquetas adesivas. O leitor do PDV lê o código de barras direto da etiqueta.</div></div>

      <div class="etq-grid">
        <div style="display:grid;gap:14px;align-content:start">
          <label class="f">Folha de etiquetas
            <select class="select" v-model="et.folhaId"><option v-for="f in FOLHAS" :key="f.id" :value="f.id">{{ f.nome }}</option></select>
            <span style="font-size:12.5px">{{ folha.desc }}</span>
          </label>

          <div><div class="muted" style="font-size:13px;margin-bottom:6px;font-weight:500">Incluir na etiqueta</div>
            <label class="row" style="gap:8px;font-size:14px;margin-bottom:4px" v-for="c in CAMPOS" :key="c[0]"><input type="checkbox" v-model="et.campos[c[0]]"> {{ c[1] }}</label></div>

          <div><div class="muted" style="font-size:13px;margin-bottom:6px;font-weight:500">Prévia (tamanho ampliado)</div>
            <div class="previa" v-if="exemplo" :style="{ width: folha.largura * ESCALA + 'px', height: folha.altura * ESCALA + 'px' }">
              <span class="pv-mini" v-if="et.campos.loja">Pocar Sport</span>
              <b class="pv-nome" v-if="et.campos.nome">{{ exemplo.nome }}</b>
              <span class="pv-var" v-if="et.campos.variacao">{{ exemplo.variacao }}</span>
              <template v-if="et.campos.codigoBarras && barras.length">
                <svg class="pv-barras" viewBox="0 0 95 30" preserveAspectRatio="none" aria-hidden="true"><rect v-for="(s,i) in barras" :key="i" :x="s.inicio" y="0" :width="s.largura" height="30" fill="#000"/></svg>
                <span class="pv-dig">{{ exemplo.codigoBarras }}</span>
              </template>
              <span class="pv-mini" v-if="et.campos.sku">{{ exemplo.sku }}</span>
              <b class="pv-preco" v-if="et.campos.preco">{{ brl(exemplo.preco) }}</b>
            </div>
            <div class="empty" v-else>Cadastre um produto para ver a prévia.</div>
          </div>

          <div class="grid g-2" style="gap:10px">
            <label class="f">Começar na etiqueta nº<input class="input" type="number" min="1" :max="capacidade" v-model.number="et.inicio"></label>
            <div style="font-size:12.5px;align-self:end" class="muted">Para aproveitar uma folha já usada. 1 = canto superior esquerdo.</div>
            <label class="f">Ajuste horizontal (mm)<input class="input" type="number" step="0.5" min="-5" max="5" v-model.number="et.ajusteX"></label>
            <label class="f">Ajuste vertical (mm)<input class="input" type="number" step="0.5" min="-5" max="5" v-model.number="et.ajusteY"></label>
          </div>
          <label class="row" style="gap:8px;font-size:14px;flex-wrap:nowrap"><input type="checkbox" v-model="et.contorno"> Imprimir o contorno das etiquetas (teste de alinhamento em folha comum)</label>
        </div>

        <div style="display:grid;gap:10px;align-content:start;min-width:0">
          <div class="row" style="flex-wrap:nowrap;gap:6px">
            <input class="input" style="flex:1;min-width:0" v-model="et.busca" placeholder="Buscar produto ou código" aria-label="Buscar produto para etiqueta">
            <button class="btn sm" @click="usarEstoque" title="Uma etiqueta por peça em estoque">Usar estoque</button>
            <button class="btn sm ghost" @click="limpar">Limpar</button>
          </div>
          <div class="etq-lista">
            <div v-for="p in produtosFiltrados" :key="p.id" class="etq-prod">
              <div class="row" style="justify-content:space-between"><b style="font-size:14px">{{ p.nome }}</b><span class="muted" style="font-size:12px">{{ p.id }}, {{ brl(p.preco) }}</span></div>
              <div class="etq-var" v-for="v in p.variantes" :key="v.sku">
                <span style="flex:1;min-width:0">{{ v.tam === 'Único' ? v.cor : v.tam + ', ' + v.cor }} <span class="muted num" style="font-size:12px">{{ v.codigoBarras }}</span></span>
                <span class="muted" style="font-size:12px;white-space:nowrap">estoque {{ v.qtd }}</span>
                <div class="qty"><button @click="qtd(v.sku,-1)" aria-label="Menos uma">−</button><input class="qtd-in" type="number" min="0" v-model.number="et.qtds[v.sku]" :aria-label="'Etiquetas de ' + v.sku" placeholder="0"><button @click="qtd(v.sku,1)" aria-label="Mais uma">+</button></div>
              </div>
            </div>
            <div class="empty" v-if="!produtosFiltrados.length">Nenhum produto encontrado.</div>
          </div>
        </div>
      </div>

      <div class="tag neg" v-if="erro && etiquetas.length">{{ erro }}</div>
      <div class="row" style="justify-content:space-between">
        <span class="muted" style="font-size:14px"><b style="color:var(--ink)">{{ etiquetas.length }}</b> etiquetas em <b style="color:var(--ink)">{{ folhas }}</b> {{ folhas === 1 ? 'folha' : 'folhas' }} ({{ capacidade }} por folha)</span>
        <div class="acts"><button class="btn" @click="et.open=false">Cancelar</button><button class="btn primary" :disabled="!!erro || et.gerando" @click="gerar">{{ et.gerando ? 'Gerando o PDF…' : 'Baixar PDF das etiquetas' }}</button></div>
      </div>
      <p class="muted" style="font-size:12.5px;margin:0">Na hora de imprimir, escolha tamanho real (100%), sem "ajustar à página". Se as etiquetas saírem deslocadas, use o ajuste fino: valores positivos movem para a direita e para baixo.</p>
    </div>
  </div>
</template>

<style scoped>
.etq{width:min(1000px,100%)}
.etq-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:22px}
.etq-lista{max-height:430px;overflow:auto;border:1px solid var(--line);border-radius:var(--radius-s);padding:4px 12px}
.etq-prod{padding:10px 0;border-bottom:1px solid var(--line);display:grid;gap:6px}
.etq-prod:last-child{border-bottom:none}
.etq-var{display:flex;align-items:center;gap:10px;font-size:13.5px}
.qtd-in{width:42px;border:none;background:none;text-align:center;font-family:var(--font-num);font-size:15px;color:var(--ink);-moz-appearance:textfield}
.qtd-in::-webkit-outer-spin-button,.qtd-in::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.previa{background:#fff;color:#000;border:1px dashed #9a9a9a;border-radius:6px;padding:5px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;overflow:hidden;line-height:1.1}
.pv-nome{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.pv-var{font-size:10.5px}
.pv-mini{font-size:9px}
.pv-barras{width:66%;flex:1;min-height:16px;margin-top:2px}
.pv-dig{font-size:9px;letter-spacing:.06em}
.pv-preco{font-size:14px}
@media (max-width:860px){ .etq-grid{grid-template-columns:1fr} }
</style>
