<!-- Entrada com usuário e senha. Também aparece por cima do sistema se a sessão expirar, sem perder o que está na tela. -->
<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { api } from '@/services/api';
import { useSessionStore } from '@/stores/session';
import { useDbStore } from '@/stores/db';

const props = defineProps({ sobreposto: { type: Boolean, default: false } });
const session = useSessionStore();
const usuarios = ref([]); const escolhido = ref(null); const senha = ref(''); const erro = ref(''); const entrando = ref(false);
const mostrarSenha = ref(false);
const senhaEl = ref(null);

onMounted(async () => {
  try { usuarios.value = await api.usuarios(); if (props.sobreposto) escolhido.value = usuarios.value.find(u => u.login === session.login) || null; }
  catch (e) { erro.value = e.message; }
  if (escolhido.value) nextTick(() => senhaEl.value?.focus());
});
const escolher = u => { escolhido.value = u; senha.value = ''; erro.value = ''; mostrarSenha.value = false; nextTick(() => senhaEl.value?.focus()); };

/* Alterna entre mostrar e esconder a senha, mantendo o cursor no campo. */
const alternarSenha = () => { mostrarSenha.value = !mostrarSenha.value; nextTick(() => senhaEl.value?.focus()); };

async function entrar() {
  if (!senha.value || entrando.value) return;
  entrando.value = true; erro.value = '';
  try {
    await session.entrar(escolhido.value.login, senha.value);
    if (props.sobreposto) useDbStore().enviar(); // reenvia o que ficou pendente
  } catch (e) { erro.value = e.message; senha.value = ''; }
  finally { entrando.value = false; }
}
</script>

<template>
  <main class="login" :class="{ sobreposto }">
    <img src="@/assets/logo.png" alt="Pocar Sport, performance em cada detalhe">
    <h1 v-if="sobreposto">Sua sessão terminou. Entre de novo para continuar.</h1>
    <h1 v-else>{{ escolhido ? `Olá, ${escolhido.nome}` : 'Quem está usando o sistema?' }}</h1>

    <div class="users" v-if="!escolhido">
      <button v-for="u in usuarios" :key="u.login" @click="escolher(u)"><span class="ini">{{ u.nome.charAt(0) }}</span>{{ u.nome }}</button>
      <p v-if="!usuarios.length && !erro">Nenhum usuário cadastrado no servidor. Defina APP_USUARIOS no arquivo .env.</p>
    </div>

    <form v-else class="senha" @submit.prevent="entrar">
      <label for="senha">Senha</label>
      <div class="campo-senha">
        <input id="senha" ref="senhaEl" v-model="senha" :type="mostrarSenha ? 'text' : 'password'" autocomplete="current-password">
        <button type="button" class="olho" @click="alternarSenha"
                :aria-label="mostrarSenha ? 'Esconder senha' : 'Mostrar senha'" :aria-pressed="mostrarSenha"
                :title="mostrarSenha ? 'Esconder senha' : 'Mostrar senha'">
          <svg v-if="!mostrarSenha" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2"/><path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M2 2l20 20"/></svg>
        </button>
      </div>
      <button class="btn primary" type="submit" :disabled="!senha || entrando">{{ entrando ? 'Entrando…' : 'Entrar' }}</button>
      <button class="link" type="button" v-if="!sobreposto" @click="escolhido = null">Não é {{ escolhido.nome }}?</button>
    </form>

    <p class="erro" v-if="erro" role="alert">{{ erro }}</p>
  </main>
</template>

<style scoped>
.login{min-height:100vh; background:#000; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:22px; padding:24px; text-align:center}
.login.sobreposto{position:fixed; inset:0; z-index:80; background:rgba(0,0,0,.94)}
.login img{width:min(360px,80vw)}
.login h1{font-size:24px; margin:12px 0 0; font-weight:700; max-width:520px}
.users{display:flex; gap:14px; flex-wrap:wrap; justify-content:center}
.users button{background:#141414; color:#fff; border:2px solid #2c2c2a; border-radius:var(--radius-m); padding:18px 26px; font-size:18px; font-weight:700; display:flex; align-items:center; gap:12px; min-width:220px}
.users button:hover{border-color:var(--yellow)}
.ini{width:40px; height:40px; border-radius:50%; background:var(--yellow); color:#000; display:grid; place-items:center; font-family:var(--font-num); font-size:22px; font-style:italic}
.senha{display:grid; gap:10px; width:min(320px,100%); text-align:left}
.senha label{color:#a6a6a0; font-size:14px}
.senha input{background:#141414; color:#fff; border:2px solid #2c2c2a; border-radius:var(--radius-s); padding:12px 14px; font-size:17px}
.senha input:focus{border-color:var(--yellow); outline:none}
.campo-senha{position:relative}
.campo-senha input{width:100%; padding-right:50px}
.olho{position:absolute; right:6px; top:50%; transform:translateY(-50%); width:38px; height:38px; display:grid; place-items:center; background:none; border:none; border-radius:var(--radius-s); color:#a6a6a0; cursor:pointer}
.olho:hover, .olho:focus-visible{color:var(--yellow)}
.olho svg{width:20px; height:20px}
.senha .btn{justify-content:center; padding:12px; font-size:16px}
.link{background:none; border:none; color:#a6a6a0; text-decoration:underline; font-size:14px; justify-self:center}
p{color:#9a9a9a; font-size:14px; max-width:420px; margin:0}
.erro{color:#ff8a8a; font-weight:600}
</style>
