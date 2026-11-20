<!-- Portaria do sistema: confere a sessão, pede login, carrega os dados do servidor e só então abre o sistema. -->
<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useUiStore } from '@/stores/ui';
import { useSessionStore } from '@/stores/session';
import { useDbStore } from '@/stores/db';
import LoginScreen from '@/components/LoginScreen.vue';
import MainApp from '@/MainApp.vue';

const ui = useUiStore(); const session = useSessionStore(); const db = useDbStore();
const { toast } = storeToRefs(ui);
const { usuario, verificada, expirada } = storeToRefs(session);
const { carregado } = storeToRefs(db);
ui.applyTheme();

const erroCarga = ref('');
async function carregarDados() { erroCarga.value = ''; try { await db.carregar(); } catch (e) { erroCarga.value = e.message; } }
watch(usuario, u => { if (u && !carregado.value) carregarDados(); });

/* Avisa antes de fechar a aba se uma operação ainda está sendo gravada no servidor. */
const antesDeSair = e => { if (db.sync.salvando) { e.preventDefault(); e.returnValue = ''; } };
onMounted(async () => { window.addEventListener('beforeunload', antesDeSair); await session.verificar(); if (usuario.value) carregarDados(); });
onBeforeUnmount(() => window.removeEventListener('beforeunload', antesDeSair));
</script>

<template>
  <div class="carregando" v-if="!verificada || (usuario && !carregado)" role="status">
    <img src="@/assets/logo.png" alt="Pocar Sport">
    <span v-if="!erroCarga">Carregando…</span>
    <template v-else><span>{{ erroCarga }}</span><button class="btn primary" @click="carregarDados">Tentar de novo</button></template>
  </div>
  <LoginScreen v-else-if="!usuario" />
  <MainApp v-else />

  <LoginScreen v-if="expirada && carregado" sobreposto />
  <div class="toast" v-if="toast" role="status">{{ toast }}</div>
</template>

<style scoped>
.carregando{min-height:100vh; background:#000; color:#9a9a9a; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px}
.carregando img{width:min(300px,70vw)}
</style>
