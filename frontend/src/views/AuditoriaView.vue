<!-- Tela: Auditoria (quem fez o quê e quando). -->
<script setup>
import { onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { dShort } from '@/domain/utils';
import { useAuditStore } from '@/stores/audit';

const audit = useAuditStore();
const { audq, registros, usuariosNoLog, temMais, carregando, erro } = storeToRefs(audit);
let espera = null;
onMounted(() => audit.carregar());
watch(() => [audq.value.usuario, audq.value.periodo], () => audit.carregar());
watch(() => audq.value.busca, () => { clearTimeout(espera); espera = setTimeout(() => audit.carregar(), 350); });
const periodos = [['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['tudo', 'Tudo']];
</script>

<template>
  <section class="content">
    <div class="card">
      <div class="row" style="margin-bottom:12px">
        <input class="input" v-model="audq.busca" placeholder="Buscar: cancelada, removido do caixa, nome do cliente, nº da venda…" style="flex:1;min-width:220px" aria-label="Buscar na auditoria">
        <select class="select" v-model="audq.usuario" aria-label="Usuário"><option value="">Todos os usuários</option><option v-for="u in usuariosNoLog" :key="u" :value="u">{{ u }}</option></select>
      </div>
      <div class="chips" style="margin-bottom:12px">
        <button class="chip" v-for="p in periodos" :key="p[0]" :class="{on:audq.periodo===p[0]}" @click="audq.periodo=p[0]">{{ p[1] }}</button>
      </div>
      <div class="scroll-x"><table>
        <thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Detalhes</th></tr></thead>
        <tbody><tr v-for="a in registros" :key="a.id">
          <td style="white-space:nowrap">{{ dShort(a.quando) }} {{ a.quando.slice(11, 16) }}</td>
          <td><b>{{ a.usuario }}</b></td>
          <td style="white-space:nowrap"><span class="tag" :class="/cancel|Devolu|Troca|Estorno/.test(a.acao)?'neg':/[Cc]aixa|Sangria|Suprimento/.test(a.acao)?'y':''">{{ a.acao }}</span></td>
          <td class="muted">{{ a.detalhe }}</td>
        </tr></tbody>
      </table></div>
      <div class="tag neg" v-if="erro">{{ erro }}</div>
      <div class="empty" v-if="!registros.length && !carregando && !erro">Nenhum registro com esses filtros.</div>
      <div class="row" style="justify-content:space-between;margin-top:12px">
        <span class="muted" style="font-size:13px">{{ carregando ? 'Carregando…' : registros.length + ' registros.' }} Gravados pelo servidor, com usuário e horário dele; não podem ser alterados nem apagados.</span>
        <button class="btn sm" v-if="temMais" :disabled="carregando" @click="audit.carregar(true)">Mostrar mais</button>
      </div>
    </div>
  </section>
</template>
