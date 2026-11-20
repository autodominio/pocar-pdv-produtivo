<!-- Criar ou editar usuário, escolhendo os menus liberados; ou redefinir a senha. -->
<script setup>
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useUsuariosStore, MENUS_LIBERAVEIS } from '@/stores/usuarios';

const store = useUsuariosStore();
const { form } = storeToRefs(store);
const { alternarMenu, salvar } = store;
const erro = computed(() => store.formErro());
const titulo = computed(() => form.value.modo === 'novo' ? 'Novo usuário' : form.value.modo === 'senha' ? `Nova senha de ${form.value.nome}` : `Editar ${form.value.nome}`);
</script>

<template>
  <div class="ov" v-if="form.open" @click.self="form.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="us-t">
      <h3 id="us-t">{{ titulo }}</h3>
      <template v-if="form.modo !== 'senha'">
        <div class="grid g-2" style="gap:12px">
          <label class="f">Nome<input class="input" v-model="form.nome" placeholder="Ex.: Ana Souza" autocomplete="off"></label>
          <label class="f">Login<input class="input" v-model="form.login" :disabled="form.modo!=='novo'" placeholder="Ex.: ana" autocomplete="off" autocapitalize="none"></label>
        </div>
      </template>
      <label class="f" v-if="form.modo !== 'editar'">{{ form.modo==='novo' ? 'Senha inicial' : 'Nova senha' }} (mínimo 8 caracteres)
        <span class="row" style="gap:6px;flex-wrap:nowrap">
          <input class="input" :type="form.mostrarSenha ? 'text' : 'password'" v-model="form.senha" autocomplete="new-password" style="flex:1">
          <button class="btn sm" type="button" @click="form.mostrarSenha=!form.mostrarSenha">{{ form.mostrarSenha ? 'Ocultar' : 'Mostrar' }}</button>
        </span>
      </label>
      <template v-if="form.modo !== 'senha'">
        <label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" v-model="form.admin"> <span><b>Administrador</b> <span class="muted" style="font-size:13px">acessa todos os menus e cria usuários</span></span></label>
        <div v-if="!form.admin">
          <div class="muted" style="font-size:13px;margin-bottom:6px">Menus que este usuário pode abrir</div>
          <div class="chips">
            <button v-for="m in MENUS_LIBERAVEIS" :key="m.id" type="button" class="chip" :class="{on: form.menus.includes(m.id)}" @click="alternarMenu(m.id)" :aria-pressed="form.menus.includes(m.id)">{{ m.label }}</button>
          </div>
        </div>
        <label class="row" style="gap:8px;cursor:pointer" v-if="form.modo==='editar'"><input type="checkbox" v-model="form.ativo"> <span>Usuário ativo <span class="muted" style="font-size:13px">(desativado não entra e some da tela de entrada)</span></span></label>
      </template>
      <div class="muted" style="font-size:13px" v-if="erro">{{ erro }}</div>
      <div class="acts"><button class="btn" @click="form.open=false">Cancelar</button><button class="btn primary" :disabled="!!erro" @click="salvar">{{ form.modo==='senha' ? 'Redefinir senha' : 'Salvar' }}</button></div>
    </div>
  </div>
</template>
