<!-- Tela: Financeiro. -->
<script setup>
import { storeToRefs } from 'pinia';
import CampoData from '@/components/form/CampoData.vue';
import { FIN_TABS, CAT_DESP } from '@/domain/constants';
import { icons } from '@/domain/icons';
import { brl, brl0, cap, curMonth, dShort, monthName, pct, todayIso } from '@/domain/utils';
import { useFinanceStore } from '@/stores/finance';
import { useReportsStore } from '@/stores/reports';
import { useDbStore } from '@/stores/db';

const finTabs = FIN_TABS;
const { fin, finMes, lancMes, contasPagar, contasReceber, abertos, fluxoDias, fluxoMax, dre, lucroAtual,
  lucroFiltro, lucroPeriodoValido, lucroPeriodo, lucroSemanas } = storeToRefs(useFinanceStore());
const { shiftFin, baixar, openLanc, openFechamento, atalhosLucro, usarAtalhoLucro, openFixa, alternarFixa, proximaFixa } = useFinanceStore();
const finance = useFinanceStore();
const state = useDbStore().state;
const semana = w => w.ini === w.fim ? dShort(w.ini) : `${dShort(w.ini)} a ${dShort(w.fim)}`;
const { openRelatorio } = useReportsStore();
</script>

<template>
  <section class="content">
    <div class="row" style="justify-content:space-between">
      <div class="row" style="gap:6px">
        <button class="btn sm" @click="shiftFin(-1)" aria-label="Mês anterior">‹</button>
        <b style="font-size:18px;min-width:170px;text-align:center">{{ cap(monthName(fin.mes, true)) }}</b>
        <button class="btn sm" @click="shiftFin(1)" :disabled="fin.mes>=curMonth" aria-label="Próximo mês">›</button>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn" @click="openRelatorio"><span v-html="icons.download"></span>Exportar PDF</button>
        <button class="btn primary" @click="openLanc"><span v-html="icons.plus"></span>Novo lançamento</button>
      </div>
    </div>
    <div class="grid g-4">
      <div class="card kpi"><div class="k">Entradas recebidas</div><div class="v pos">{{ brl0(finMes.entradas) }}</div><div class="s">Vendas e outras receitas pagas</div></div>
      <div class="card kpi"><div class="k">Saídas pagas</div><div class="v neg">{{ brl0(finMes.saidas) }}</div><div class="s">Despesas, fornecedores e taxas</div></div>
      <div class="card kpi"><div class="k">Saldo do mês</div><div class="v" :class="finMes.saldo>=0?'pos':'neg'">{{ brl0(finMes.saldo) }}</div><div class="s">Regime de caixa</div></div>
      <div class="card kpi"><div class="k">Em aberto</div><div class="v">{{ brl0(abertos.receber - abertos.pagar) }}</div><div class="s">{{ brl0(abertos.receber) }} a receber, {{ brl0(abertos.pagar) }} a pagar</div></div>
    </div>
    <div class="card">
      <div class="tabs" role="tablist">
        <button v-for="t in finTabs" :key="t.id" :class="{on:fin.tab===t.id}" @click="fin.tab=t.id" role="tab" :aria-selected="fin.tab===t.id">{{ t.label }}</button>
      </div>

      <div v-if="fin.tab==='fluxo'">
        <svg class="chart" viewBox="0 0 720 230" role="img" aria-label="Fluxo de caixa diário">
          <line x1="30" x2="716" y1="115" y2="115" stroke="var(--line)"></line>
          <g v-for="(d,i) in fluxoDias" :key="d.dia">
            <rect :x="34+i*(680/fluxoDias.length)" :y="115-d.ent/fluxoMax*100" :width="Math.max(3,680/fluxoDias.length-5)" :height="d.ent/fluxoMax*100" fill="var(--pos)" rx="1"><title>{{ dShort(d.dia) }}: entrou {{ brl(d.ent) }}</title></rect>
            <rect :x="34+i*(680/fluxoDias.length)" y="115" :width="Math.max(3,680/fluxoDias.length-5)" :height="d.sai/fluxoMax*100" fill="var(--neg)" rx="1"><title>{{ dShort(d.dia) }}: saiu {{ brl(d.sai) }}</title></rect>
            <text v-if="i%3===0" :x="34+i*(680/fluxoDias.length)+4" y="228" text-anchor="middle">{{ +d.dia.slice(8) }}</text>
          </g>
          <text x="34" y="12">+{{ brl0(fluxoMax) }}</text>
          <text x="34" y="222">−{{ brl0(fluxoMax) }}</text>
        </svg>
        <div class="row muted" style="font-size:13px;margin:6px 0 16px"><span><span class="swatch" style="background:var(--pos)"></span> Entradas</span><span><span class="swatch" style="background:var(--neg)"></span> Saídas</span></div>
        <div class="row" style="margin-bottom:10px">
          <div class="chips">
            <button class="chip" :class="{on:fin.filtro===''}" @click="fin.filtro=''">Tudo</button>
            <button class="chip" :class="{on:fin.filtro==='receita'}" @click="fin.filtro='receita'">Receitas</button>
            <button class="chip" :class="{on:fin.filtro==='despesa'}" @click="fin.filtro='despesa'">Despesas</button>
          </div>
        </div>
        <div class="scroll-x"><table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Origem</th><th>Situação</th><th class="r">Valor</th></tr></thead>
          <tbody><tr v-for="l in lancMes.slice(0,fin.limite)" :key="l.id">
            <td>{{ dShort(l.status==='pago'?l.pagoEm:l.venc) }}</td><td>{{ l.descricao }}</td><td class="muted">{{ l.categoria }}</td>
            <td><span class="tag" :class="l.origem==='PDV'?'y':''">{{ l.origem }}</span></td>
            <td><span class="tag" v-if="l.status==='cancelado'">Cancelado</span><span class="tag" v-else :class="l.status==='pago'?'pos':(l.venc<todayIso?'neg':'warn')">{{ l.status==='pago'?(l.tipo==='receita'?'Recebido':'Pago'):(l.venc<todayIso?'Vencido':'Pendente') }}</span></td>
            <td class="r num" style="font-size:16px" :class="l.tipo==='receita'?'pos':'neg'">{{ l.tipo==='receita'?'':'− ' }}{{ brl(l.valor) }}</td>
          </tr></tbody>
        </table></div>
        <div class="empty" v-if="!lancMes.length">Sem lançamentos neste mês.</div>
        <button class="btn sm" style="margin-top:12px" v-if="lancMes.length>fin.limite" @click="fin.limite+=40">Mostrar mais ({{ lancMes.length-fin.limite }} restantes)</button>
      </div>

      <div v-if="fin.tab==='contas'">
        <div class="grid g-2">
          <div>
            <h2>A pagar <small>{{ brl(abertos.pagar) }}</small></h2>
            <div class="list">
              <div class="it" v-for="l in contasPagar" :key="l.id">
                <div class="grow"><div class="t">{{ l.descricao }}</div><div class="d">{{ l.categoria }}, vence {{ dShort(l.venc) }}</div></div>
                <span class="tag neg" v-if="l.venc<todayIso">Vencida</span>
                <b class="num neg" style="font-size:17px">{{ brl(l.valor) }}</b>
                <button class="btn sm" @click="baixar(l)">Pagar</button>
              </div>
              <div class="empty" v-if="!contasPagar.length">Nada a pagar.</div>
            </div>
          </div>
          <div>
            <h2>A receber <small>{{ brl(abertos.receber) }}</small></h2>
            <div class="list">
              <div class="it" v-for="l in contasReceber.slice(0,fin.limiteRec)" :key="l.id">
                <div class="grow"><div class="t">{{ l.descricao }}</div><div class="d">{{ l.categoria }}, cai em {{ dShort(l.venc) }}</div></div>
                <b class="num pos" style="font-size:17px">{{ brl(l.valor) }}</b>
                <button class="btn sm" @click="baixar(l)">Receber</button>
              </div>
              <div class="empty" v-if="!contasReceber.length">Nada a receber.</div>
            </div>
            <button class="btn sm" style="margin-top:10px" v-if="contasReceber.length>fin.limiteRec" @click="fin.limiteRec+=20">Mostrar mais</button>
          </div>
        </div>
      </div>

      <div v-if="fin.tab==='lucro'">
        <p class="muted" style="margin-top:0">O que sobrou em cada semana (de segunda a domingo) depois do custo das peças vendidas, das taxas de cartão, dos vales e cashback usados e das despesas da loja.</p>
        <div class="row" style="gap:12px;align-items:flex-end;margin-bottom:12px">
          <label class="f" style="width:150px">De<CampoData v-model="lucroFiltro.ini" /></label>
          <label class="f" style="width:150px">Até<CampoData v-model="lucroFiltro.fim" /></label>
          <div class="chips"><button v-for="a in atalhosLucro" :key="a.id" class="chip" @click="usarAtalhoLucro(a)">{{ a.label }}</button></div>
        </div>
        <p class="tag warn" v-if="!lucroPeriodoValido">Escolha as duas datas, com a inicial antes da final.</p>
        <template v-else>
          <div class="grid g-3" style="gap:12px;margin-bottom:16px">
            <div class="receipt"><span class="muted" style="font-size:13px">Lucro no período</span><b class="num" style="font-size:26px" :class="lucroPeriodo.resultado>=0?'pos':'neg'">{{ brl(lucroPeriodo.resultado) }}</b><span class="muted" style="font-size:12px">{{ lucroPeriodo.vendas }} vendas, margem de {{ pct(lucroPeriodo.margem) }}</span></div>
            <div class="receipt"><span class="muted" style="font-size:13px">Média por semana</span><b class="num" style="font-size:26px">{{ brl(lucroSemanas.length ? lucroPeriodo.resultado / lucroSemanas.length : 0) }}</b><span class="muted" style="font-size:12px">{{ lucroSemanas.length }} {{ lucroSemanas.length===1 ? 'semana' : 'semanas' }} no período</span></div>
            <div class="receipt"><span class="muted" style="font-size:13px">Projeção do mês</span><b class="num" style="font-size:26px" :class="lucroAtual.projetado>=0?'pos':'neg'">{{ brl(lucroAtual.projetado) }}</b><span class="muted" style="font-size:12px">{{ cap(monthName(curMonth)) }}, mantendo o ritmo de vendas</span></div>
          </div>
          <div class="scroll-x"><table>
            <thead><tr><th>Semana</th><th class="r">Vendas líquidas</th><th class="r">Custo das peças</th><th class="r">Taxas, vales e cashback</th><th class="r">Despesas</th><th class="r">Lucro</th><th class="r">Margem</th></tr></thead>
            <tbody>
              <tr v-for="w in lucroSemanas" :key="w.ini">
                <td style="white-space:nowrap"><b>{{ semana(w) }}</b> <span class="tag warn" v-if="w.atual">Em andamento</span></td>
                <td class="r num" style="font-size:15px">{{ brl(w.liquida) }}</td>
                <td class="r num" style="font-size:15px">{{ brl(w.cmv) }}</td>
                <td class="r num" style="font-size:15px">{{ brl(w.taxas + w.fidelidade) }}</td>
                <td class="r num" style="font-size:15px">{{ brl(w.totalDespesas) }}</td>
                <td class="r num" style="font-size:18px;font-weight:700" :class="w.resultado>=0?'pos':'neg'">{{ brl(w.resultado) }}</td>
                <td class="r num" style="font-size:15px">{{ w.liquida > 0 ? pct(w.margem) : '—' }}</td>
              </tr>
              <tr class="tot"><td><b>Total do período</b></td><td class="r num">{{ brl(lucroPeriodo.liquida) }}</td><td class="r num">{{ brl(lucroPeriodo.cmv) }}</td><td class="r num">{{ brl(lucroPeriodo.taxas + lucroPeriodo.fidelidade) }}</td><td class="r num">{{ brl(lucroPeriodo.totalDespesas) }}</td><td class="r num" style="font-size:18px;font-weight:700" :class="lucroPeriodo.resultado>=0?'pos':'neg'">{{ brl(lucroPeriodo.resultado) }}</td><td class="r num">{{ pct(lucroPeriodo.margem) }}</td></tr>
            </tbody>
          </table></div>
          <p class="muted" style="font-size:13px">As despesas entram na semana em que vencem (o aluguel cai inteiro na semana do vencimento). O resultado do mês fechado fica na aba Resultado (DRE).</p>
        </template>
      </div>

      <div v-if="fin.tab==='dre'">
        <p class="muted" style="margin-top:0">Resultado de {{ monthName(fin.mes, true) }} por competência, montado a partir das vendas do PDV e dos lançamentos.</p>
        <div class="scroll-x"><table class="dre" style="max-width:640px">
          <tbody>
            <tr><td>Receita bruta de vendas</td><td class="r num">{{ brl(dre.bruta) }}</td><td class="r muted">100%</td></tr>
            <tr class="sub"><td>(−) Descontos concedidos</td><td class="r num neg">{{ brl(dre.descontos) }}</td><td class="r muted">{{ pct(dre.descontos/dre.bruta) }}</td></tr>
            <tr class="sub" v-if="dre.devolucoes>0"><td>(−) Devoluções e trocas</td><td class="r num neg">{{ brl(dre.devolucoes) }}</td><td class="r muted">{{ pct(dre.devolucoes/dre.bruta) }}</td></tr>
            <tr class="sub"><td>(−) Vales e cashback usados</td><td class="r num neg">{{ brl(dre.fidelidade) }}</td><td class="r muted">{{ pct(dre.fidelidade/dre.bruta) }}</td></tr>
            <tr class="tot"><td>Receita líquida</td><td class="r num">{{ brl(dre.liquida) }}</td><td class="r muted">{{ pct(dre.liquida/dre.bruta) }}</td></tr>
            <tr class="sub"><td>(−) Custo das peças vendidas</td><td class="r num neg">{{ brl(dre.cmv) }}</td><td class="r muted">{{ pct(dre.cmv/dre.bruta) }}</td></tr>
            <tr class="sub"><td>(−) Taxas de cartão</td><td class="r num neg">{{ brl(dre.taxas) }}</td><td class="r muted">{{ pct(dre.taxas/dre.bruta) }}</td></tr>
            <tr class="tot"><td>Lucro bruto</td><td class="r num">{{ brl(dre.lucroBruto) }}</td><td class="r muted">{{ pct(dre.lucroBruto/dre.bruta) }}</td></tr>
            <tr class="sub" v-for="c in dre.despesas" :key="c.cat"><td>(−) {{ c.cat }}</td><td class="r num neg">{{ brl(c.valor) }}</td><td class="r muted">{{ pct(c.valor/dre.bruta) }}</td></tr>
            <tr class="sub" v-if="dre.encargos>0"><td>(+) Juros e multas do crediário</td><td class="r num pos">{{ brl(dre.encargos) }}</td><td class="r muted">{{ pct(dre.encargos/dre.bruta) }}</td></tr>
            <tr class="tot"><td>Resultado do mês</td><td class="r num" :class="dre.resultado>=0?'pos':'neg'" style="font-size:18px">{{ brl(dre.resultado) }}</td><td class="r muted">{{ pct(dre.resultado/dre.bruta) }}</td></tr>
          </tbody>
        </table></div>
        <p class="muted" style="font-size:13px">Compras de fornecedor entram no estoque e viram custo só quando a peça é vendida, por isso não aparecem como despesa aqui.</p>
        <div class="row" style="gap:10px">
          <span class="tag pos" v-if="state.fechamentos[fin.mes]">Mês fechado em {{ dShort(state.fechamentos[fin.mes].fechadoEm) }}: lucro registrado de {{ brl(state.fechamentos[fin.mes].resultado) }}</span>
          <span class="tag warn" v-else-if="fin.mes >= curMonth">Mês em andamento</span>
          <button class="btn sm" v-else @click="openFechamento(fin.mes)">Fechar o mês e registrar o lucro</button>
        </div>
      </div>

      <div v-if="fin.tab==='fixas'">
        <div class="row" style="justify-content:space-between;margin-bottom:12px">
          <p class="muted" style="margin:0;max-width:620px">Despesas que se repetem todo mês. O sistema cria sozinho a conta a pagar de cada mês no dia escolhido; ela aparece em Contas a pagar com um mês de antecedência e é paga como as outras.</p>
          <button class="btn primary" @click="openFixa()"><span v-html="icons.plus"></span>Nova despesa fixa</button>
        </div>
        <div class="scroll-x"><table>
          <thead><tr><th>Despesa</th><th>Categoria</th><th class="r">Valor mensal</th><th>Pagamento</th><th>Próximo vencimento</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            <tr v-for="d in state.despesasFixas" :key="d.id" :style="{opacity: d.ativa ? 1 : .55}">
              <td><b>{{ d.descricao }}</b></td>
              <td>{{ d.categoria }}</td>
              <td class="r num" style="font-size:16px">{{ brl(d.valor) }}</td>
              <td style="white-space:nowrap">Todo dia {{ d.dia }}</td>
              <td class="num" style="font-size:15px">{{ d.ativa ? dShort(proximaFixa(d)) : '—' }}</td>
              <td><span class="tag" :class="d.ativa ? 'pos' : 'neg'">{{ d.ativa ? 'Ativa' : 'Desativada' }}</span></td>
              <td class="r" style="white-space:nowrap"><button class="btn sm" @click="openFixa(d)" v-if="d.ativa">Editar</button> <button class="btn sm" @click="alternarFixa(d)">{{ d.ativa ? 'Desativar' : 'Reativar' }}</button></td>
            </tr>
            <tr v-if="!state.despesasFixas.length"><td colspan="7" class="muted">Nenhuma despesa fixa. Cadastre aluguel, internet, salários e outras contas que se repetem.</td></tr>
          </tbody>
        </table></div>
        <p class="muted" style="font-size:13px">Ao mudar o valor ou o dia, as contas em aberto deste mês em diante são atualizadas; as já pagas ficam como foram pagas. Em mês mais curto, o dia 31 vence no último dia do mês.</p>
      </div>
    </div>
  </section>
</template>
