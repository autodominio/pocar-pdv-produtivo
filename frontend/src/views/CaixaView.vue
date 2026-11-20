<!-- Tela: Caixa e vendas (abertura, adicionar/remover dinheiro, fechamento, lista de vendas e histórico de caixas). -->
<script setup>
import { storeToRefs } from 'pinia';
import { PAY_LABEL } from '@/domain/constants';
import { brl, dShort, dtShort } from '@/domain/utils';
import { useCaixaStore } from '@/stores/caixa';
import { useVendasStore } from '@/stores/vendas';

const { atual, resumoAtual, historico, vq, vendasLista } = storeToRefs(useCaixaStore());
const { openAbrir, openMov, openFechar } = useCaixaStore();
const { abrirVenda } = useVendasStore();
const hora = s => s.slice(11, 16);
const abas = [{ id: 'atual', label: 'Caixa de hoje' }, { id: 'vendas', label: 'Vendas' }, { id: 'historico', label: 'Histórico de caixas' }];
</script>

<template>
  <section class="content">
    <div class="tabs" role="tablist" style="margin-bottom:0">
      <button v-for="t in abas" :key="t.id" :class="{on:vq.tab===t.id}" @click="vq.tab=t.id" role="tab" :aria-selected="vq.tab===t.id">{{ t.label }}</button>
    </div>

    <template v-if="vq.tab==='atual'">
      <div class="meta-hero" v-if="atual">
        <div class="head">
          <div>
            <div style="color:#a0a0a0;font-size:14px">Caixa aberto às {{ hora(atual.abertoEm) }} de {{ dShort(atual.abertoEm) }} por {{ atual.abertoPor }}</div>
            <div style="color:#a0a0a0;font-size:14px;margin-top:10px">Dinheiro que deve estar na gaveta</div>
            <div class="pct" style="font-size:58px">{{ brl(resumoAtual.esperado) }}</div>
          </div>
          <div class="row" style="gap:8px">
            <button class="btn sm" @click="openMov('suprimento')">+ Adicionar ao caixa</button>
            <button class="btn sm" @click="openMov('sangria')">− Remover do caixa</button>
            <button class="btn primary" style="color:#000;border-color:var(--yellow);background:var(--yellow)" @click="openFechar">Fechar caixa</button>
          </div>
        </div>
        <div class="facts">
          <div><div class="k">Vendas</div><div class="v">{{ resumoAtual.qtdVendas }} <small style="font-size:15px;color:#a0a0a0">{{ brl(resumoAtual.totalVendas) }}</small></div></div>
          <div><div class="k">Troco inicial</div><div class="v">{{ brl(atual.valorInicial) }}</div></div>
          <div><div class="k">Entrou em dinheiro</div><div class="v">{{ brl(resumoAtual.dinheiroEntrou + resumoAtual.suprimentos) }}</div></div>
          <div><div class="k">Saiu da gaveta</div><div class="v">{{ brl(resumoAtual.dinheiroSaiu + resumoAtual.sangrias) }}</div></div>
        </div>
      </div>
      <div class="card" v-else style="text-align:center;padding:40px 20px">
        <h2 style="font-size:22px">O caixa está fechado</h2>
        <p class="muted" style="margin-top:0">Para vender, abra o caixa informando o dinheiro de troco que está na gaveta.</p>
        <button class="btn primary" style="padding:12px 22px;font-size:16px" @click="openAbrir">Abrir caixa</button>
        <p class="muted" style="font-size:13px;margin-bottom:0" v-if="historico[0]">Último fechamento: {{ dtShort(historico[0].fechadoEm) }} por {{ historico[0].fechadoPor }}, {{ brl(historico[0].contado) }} na gaveta.</p>
      </div>

      <div class="grid g-2" v-if="atual">
        <div class="card">
          <h2>Vendas por forma de pagamento</h2>
          <div class="list" v-if="resumoAtual.porForma.length">
            <div class="it" v-for="f in resumoAtual.porForma" :key="f.k"><div class="grow"><div class="t">{{ f.label }}</div></div><b class="num" style="font-size:17px">{{ brl(f.valor) }}</b></div>
          </div>
          <div class="empty" v-else>Nenhuma venda neste caixa ainda.</div>
          <div class="muted" style="font-size:13px;margin-top:8px" v-if="resumoAtual.recebCrediario || resumoAtual.estornos || resumoAtual.canceladas">
            <span v-if="resumoAtual.recebCrediario">Parcelas de crediário recebidas: {{ brl(resumoAtual.recebCrediario) }}. </span>
            <span v-if="resumoAtual.estornos">Estornos a clientes: {{ brl(resumoAtual.estornos) }}. </span>
            <span v-if="resumoAtual.canceladas">{{ resumoAtual.canceladas }} venda(s) cancelada(s).</span>
          </div>
        </div>
        <div class="card">
          <h2>Movimentos da gaveta</h2>
          <div class="list">
            <div class="it"><div class="grow"><div class="t">Abertura</div><div class="d">{{ hora(atual.abertoEm) }}, {{ atual.abertoPor }}{{ atual.obsAbertura ? '. ' + atual.obsAbertura : '' }}</div></div><b class="num" style="font-size:17px">{{ brl(atual.valorInicial) }}</b></div>
            <div class="it" v-for="m in atual.movs" :key="m.id">
              <div class="grow"><div class="t">{{ m.tipo === 'sangria' ? 'Removido do caixa' : 'Adicionado ao caixa' }}</div><div class="d">{{ hora(m.quando) }}, {{ m.usuario }}. {{ m.motivo }}</div></div>
              <b class="num" style="font-size:17px" :class="m.tipo==='sangria'?'neg':'pos'">{{ m.tipo === 'sangria' ? '−' : '+' }} {{ brl(m.valor) }}</b>
            </div>
          </div>
          <p class="muted" style="font-size:13px;margin-bottom:0">Use <b>Remover do caixa</b> quando tirar dinheiro da gaveta (depósito no banco, pagamento em espécie) e <b>Adicionar ao caixa</b> quando colocar (reforço de troco).</p>
        </div>
      </div>
    </template>

    <div class="card" v-if="vq.tab==='vendas'">
      <div class="row" style="margin-bottom:12px">
        <input class="input" v-model="vq.busca" placeholder="Buscar pelo número da venda ou nome do cliente" style="flex:1;min-width:200px" aria-label="Buscar venda">
      </div>
      <div class="row" style="margin-bottom:12px;gap:16px">
        <div class="chips">
          <button class="chip" v-for="p in [['hoje','Hoje'],['7d','7 dias'],['30d','30 dias'],['tudo','Tudo']]" :key="p[0]" :class="{on:vq.periodo===p[0]}" @click="vq.periodo=p[0]">{{ p[1] }}</button>
        </div>
        <div class="chips">
          <button class="chip" v-for="p in [['','Todas'],['cancelada','Canceladas'],['devolucao','Com devolução']]" :key="p[0]" :class="{on:vq.status===p[0]}" @click="vq.status=p[0]">{{ p[1] }}</button>
        </div>
      </div>
      <div class="scroll-x"><table>
        <thead><tr><th>Venda</th><th>Data</th><th>Cliente</th><th>Pagamento</th><th class="r">Total</th><th>Situação</th></tr></thead>
        <tbody><tr class="click" v-for="x in vendasLista" :key="x.s.id" @click="abrirVenda(x.s.id)" tabindex="0" @keydown.enter="abrirVenda(x.s.id)">
          <td><b>#{{ x.s.id }}</b></td>
          <td style="white-space:nowrap">{{ dtShort(x.s.data) }}</td>
          <td>{{ x.cliente || '—' }}</td>
          <td style="white-space:nowrap">{{ PAY_LABEL[x.s.pagamento] }}{{ x.s.parcelas > 1 ? ' ' + x.s.parcelas + 'x' : '' }}</td>
          <td class="r num" style="font-size:16px">{{ brl(x.s.total) }}</td>
          <td><span class="tag neg" v-if="x.status==='cancelada'">Cancelada</span><span class="tag warn" v-else-if="x.status==='devolucao'">Com devolução</span><span class="tag pos" v-else>Concluída</span></td>
        </tr></tbody>
      </table></div>
      <div class="empty" v-if="!vendasLista.length">Nenhuma venda com esses filtros.</div>
    </div>

    <div class="card" v-if="vq.tab==='historico'">
      <div class="scroll-x"><table>
        <thead><tr><th>Dia</th><th>Abertura</th><th>Fechamento</th><th class="r">Vendas</th><th class="r">Esperado</th><th class="r">Contado</th><th>Conferência</th></tr></thead>
        <tbody><tr v-for="c in historico" :key="c.id">
          <td><b>{{ dShort(c.abertoEm) }}</b></td>
          <td style="white-space:nowrap">{{ hora(c.abertoEm) }}, {{ c.abertoPor }}</td>
          <td style="white-space:nowrap">{{ hora(c.fechadoEm) }}, {{ c.fechadoPor }}</td>
          <td class="r num" style="font-size:15px">{{ brl(c.resumo.totalVendas) }}</td>
          <td class="r num" style="font-size:15px">{{ brl(c.esperado) }}</td>
          <td class="r num" style="font-size:15px">{{ brl(c.contado) }}</td>
          <td><span class="tag pos" v-if="!c.diferenca">Confere</span><span class="tag" :class="c.diferenca<0?'neg':'warn'" v-else>{{ c.diferenca < 0 ? 'Faltou' : 'Sobrou' }} {{ brl(Math.abs(c.diferenca)) }}</span><div class="muted" style="font-size:12px" v-if="c.obs">{{ c.obs }}</div></td>
        </tr></tbody>
      </table></div>
      <div class="empty" v-if="!historico.length">Nenhum caixa fechado ainda.</div>
    </div>
  </section>
</template>
