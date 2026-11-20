<!-- Tela: usuários e acessos (só administrador). -->
<script setup>
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { icons, VIEWS } from '@/domain/icons';
import { useUsuariosStore } from '@/stores/usuarios';
import { useSessionStore } from '@/stores/session';

const store = useUsuariosStore();
const { lista, carregando, erro } = storeToRefs(store);
const { abrirNovo, abrirEdicao, abrirSenha } = store;
const { login: meuLogin } = storeToRefs(useSessionStore());
const nomeMenu = id => (VIEWS.find(v => v.id === id) || {}).label || id;
onMounted(() => store.carregar());
</script>

<template>
  <section class="content">
    <div class="card">
      <div class="row" style="justify-content:space-between;margin-bottom:12px">
        <p class="muted" style="margin:0;max-width:640px">Cada usuário entra com o próprio login e senha e vê só os menus liberados. O administrador vê tudo e cuida desta tela. Usuário novo já aparece na tela de entrada.</p>
        <button class="btn primary" @click="abrirNovo"><span v-html="icons.plus"></span>Novo usuário</button>
      </div>
      <div class="tag neg" v-if="erro">{{ erro }}</div>
      <div class="scroll-x"><table>
        <thead><tr><th>Usuário</th><th>Login</th><th>Acesso</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          <tr v-for="u in lista" :key="u.id" :style="{opacity: u.ativo ? 1 : .55}">
            <td style="white-space:nowrap"><b>{{ u.nome }}</b> <span class="muted" v-if="u.login===meuLogin" style="font-size:13px">(você)</span></td>
            <td class="num" style="font-size:15px">{{ u.login }}</td>
            <td><span class="tag y" v-if="u.admin">Administrador</span><span v-else style="font-size:14px">{{ u.menus.map(nomeMenu).join(', ') }}</span></td>
            <td><span class="tag" :class="u.ativo ? 'pos' : 'neg'">{{ u.ativo ? 'Ativo' : 'Desativado' }}</span></td>
            <td class="r" style="white-space:nowrap"><button class="btn sm" @click="abrirEdicao(u)">Editar</button> <button class="btn sm" @click="abrirSenha(u)">Redefinir senha</button></td>
          </tr>
          <tr v-if="!lista.length && !carregando"><td colspan="5" class="muted">Nenhum usuário.</td></tr>
        </tbody>
      </table></div>
    </div>
  </section>
</template>
