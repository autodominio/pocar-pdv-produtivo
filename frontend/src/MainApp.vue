<!-- Sistema já com usuário logado e dados carregados: menu, barra superior, tela atual, modais globais e tecla Esc. -->
<script setup>
import { onMounted, onBeforeUnmount, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useUiStore } from '@/stores/ui';
import { useDbStore } from '@/stores/db';
import { usePdvStore } from '@/stores/pdv';
import { useCatalogStore } from '@/stores/catalog';
import { useGoalsStore } from '@/stores/goals';
import { useFinanceStore } from '@/stores/finance';
import { useClientsStore } from '@/stores/clients';
import { useLoyaltyStore } from '@/stores/loyalty';
import { useCreditStore } from '@/stores/credit';
import SideNav from '@/components/layout/SideNav.vue';
import TopBar from '@/components/layout/TopBar.vue';
import CartBar from '@/components/layout/CartBar.vue';
import BottomNav from '@/components/layout/BottomNav.vue';
import PainelView from '@/views/PainelView.vue';
import PdvView from '@/views/PdvView.vue';
import EstoqueView from '@/views/EstoqueView.vue';
import FinanceiroView from '@/views/FinanceiroView.vue';
import CrediarioView from '@/views/CrediarioView.vue';
import ClientesView from '@/views/ClientesView.vue';
import FidelidadeView from '@/views/FidelidadeView.vue';
import MetasView from '@/views/MetasView.vue';
import PickerModal from '@/components/modals/PickerModal.vue';
import ReciboModal from '@/components/modals/ReciboModal.vue';
import EntradaModal from '@/components/modals/EntradaModal.vue';
import NovoProdutoModal from '@/components/modals/NovoProdutoModal.vue';
import LancamentoModal from '@/components/modals/LancamentoModal.vue';
import MetasModal from '@/components/modals/MetasModal.vue';
import ClienteFichaModal from '@/components/modals/ClienteFichaModal.vue';
import ClienteFormModal from '@/components/modals/ClienteFormModal.vue';
import FidelidadeRegrasModal from '@/components/modals/FidelidadeRegrasModal.vue';
import FechamentoModal from '@/components/modals/FechamentoModal.vue';
import ReceberParcelaModal from '@/components/modals/ReceberParcelaModal.vue';
import CrediarioRegrasModal from '@/components/modals/CrediarioRegrasModal.vue';
import ResetModal from '@/components/modals/ResetModal.vue';
import SenhaModal from '@/components/modals/SenhaModal.vue';
import EtiquetasModal from '@/components/modals/EtiquetasModal.vue';
import { useEtiquetasStore } from '@/stores/etiquetas';
import RelatorioModal from '@/components/modals/RelatorioModal.vue';
import AbrirCaixaModal from '@/components/modals/AbrirCaixaModal.vue';
import MovCaixaModal from '@/components/modals/MovCaixaModal.vue';
import FecharCaixaModal from '@/components/modals/FecharCaixaModal.vue';
import VendaModal from '@/components/modals/VendaModal.vue';
import DevolucaoModal from '@/components/modals/DevolucaoModal.vue';
import CancelamentoModal from '@/components/modals/CancelamentoModal.vue';
import CaixaView from '@/views/CaixaView.vue';
import AuditoriaView from '@/views/AuditoriaView.vue';
import { useCaixaStore } from '@/stores/caixa';
import { useVendasStore } from '@/stores/vendas';
import { useReportsStore } from '@/stores/reports';
import { useSessionStore } from '@/stores/session';
import { useUsuariosStore } from '@/stores/usuarios';
import UsuariosView from '@/views/UsuariosView.vue';
import UsuarioModal from '@/components/modals/UsuarioModal.vue';
import DespesaFixaModal from '@/components/modals/DespesaFixaModal.vue';

const ui = useUiStore(); const db = useDbStore(); const pdvS = usePdvStore(); const catalog = useCatalogStore(); const goals = useGoalsStore();
const finance = useFinanceStore(); const clients = useClientsStore(); const loyalty = useLoyaltyStore(); const credit = useCreditStore();
const reports = useReportsStore(); const caixa = useCaixaStore(); const vendas = useVendasStore();
const { view } = storeToRefs(ui);
const session = useSessionStore();

/* Menu sem acesso (link antigo, favorito, outro usuário na mesma aba): vai para o primeiro menu liberado. */
watch(view, v => { if (!session.pode(v) && session.telas.length) location.replace('#' + session.telas[0].id); }, { immediate: true });

/* Esc fecha qualquer janela aberta; no recibo, já começa uma nova venda. */
const onKey = e => { if (e.key !== 'Escape') return;
  if (pdvS.recibo) pdvS.novaVenda(); pdvS.picker.open = false; catalog.entrada.open = false; catalog.novo.open = false; finance.lanc.open = false;
  goals.metasEd.open = false; ui.confirmReset = false; ui.senhaAberta = false; clients.cliForm.open = false; clients.cliDet = null; loyalty.regras.open = false;
  finance.fechamento.open = false; credit.receb.open = false; credit.credRegras.open = false; reports.rel.open = false; useEtiquetasStore().et.open = false;
  caixa.cxAbrir.open = false; caixa.cxMov.open = false; caixa.cxFechar.open = false; useUsuariosStore().form.open = false; finance.fixa.open = false;
  if (vendas.devol.open || vendas.canc.open) { vendas.devol.open = false; vendas.canc.open = false; } else vendas.fecharVenda(); };
onMounted(() => { window.addEventListener('hashchange', ui.onHash); window.addEventListener('keydown', onKey); });
onBeforeUnmount(() => { window.removeEventListener('hashchange', ui.onHash); window.removeEventListener('keydown', onKey); });
</script>

<template>
  <div class="shell">
    <SideNav />
    <div class="main">
      <TopBar />
      <PainelView v-if="view==='painel'" />
      <PdvView v-else-if="view==='pdv'" />
      <CaixaView v-else-if="view==='caixa'" />
      <EstoqueView v-else-if="view==='estoque'" />
      <FinanceiroView v-else-if="view==='financeiro'" />
      <CrediarioView v-else-if="view==='crediario'" />
      <ClientesView v-else-if="view==='clientes'" />
      <FidelidadeView v-else-if="view==='fidelidade'" />
      <MetasView v-else-if="view==='metas'" />
      <AuditoriaView v-else-if="view==='auditoria'" />
      <UsuariosView v-else-if="view==='usuarios'" />
    </div>
  </div>

  <CartBar />
  <BottomNav />

  <!-- Modais na mesma ordem do protótipo: a ordem define qual fica por cima. -->
  <PickerModal />
  <ReciboModal />
  <EntradaModal />
  <NovoProdutoModal />
  <LancamentoModal />
  <MetasModal />
  <ClienteFichaModal />
  <ClienteFormModal />
  <VendaModal />
  <DevolucaoModal />
  <CancelamentoModal />
  <FidelidadeRegrasModal />
  <FechamentoModal />
  <ReceberParcelaModal />
  <CrediarioRegrasModal />
  <RelatorioModal />
  <EtiquetasModal />
  <AbrirCaixaModal />
  <MovCaixaModal />
  <FecharCaixaModal />
  <ResetModal />

  <SenhaModal />
  <UsuarioModal />
  <DespesaFixaModal />
</template>
