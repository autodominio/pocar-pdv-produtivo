<!-- Menu lateral (desktop). -->
<script setup>
import { storeToRefs } from 'pinia';
import { useUiStore } from '@/stores/ui';
import { useSessionStore } from '@/stores/session';
import { useDbStore } from '@/stores/db';

const { usuario, telas: views, admin } = storeToRefs(useSessionStore());
const { sync } = storeToRefs(useDbStore());
const { sair } = useSessionStore();
const { view, themeLabel } = storeToRefs(useUiStore());
const ui = useUiStore();
const { toggleTheme, askReset } = ui;
</script>

<template>
  <aside class="side">
    <div class="brand"><img src="@/assets/logo.png" alt="Pocar Sport, performance em cada detalhe"></div>
    <nav class="nav">
      <a v-for="v in views" :key="v.id" :href="'#'+v.id" :class="{on:view===v.id}"><span v-html="v.icon"></span>{{ v.label }}</a>
    </nav>
    <div class="foot">
      <div>Loja: Pocar Sport<br>Usuário: <b style="color:#fff">{{ usuario }}</b></div>
      <div class="sync" :class="{ erro: sync.erro }" role="status">{{ sync.erro ? sync.erro : sync.salvando ? 'Salvando…' : 'Tudo salvo no servidor' }}</div>
      <button @click="ui.senhaAberta = true">Trocar senha</button>
      <button @click="sair">Sair</button>
      <button @click="toggleTheme">Tema: {{ themeLabel }}</button>
      <!-- <button v-if="admin" @click="askReset">Reiniciar dados</button> --->
    </div>
  </aside>
</template>

<style scoped>
.sync{font-size:12px; color:#7fd49a}
.sync.erro{color:#ffb4b4}
</style>
