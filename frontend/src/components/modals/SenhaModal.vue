<!-- Troca da própria senha. -->
<script setup>
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { api } from '@/services/api';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore(); const { senhaAberta } = storeToRefs(ui);
const atual = ref(''); const nova = ref(''); const repetida = ref(''); const erro = ref(''); const enviando = ref(false);
watch(senhaAberta, v => { if (v) { atual.value = nova.value = repetida.value = erro.value = ''; } });
const problema = computed(() => !atual.value ? 'Informe a senha atual.' : nova.value.length < 8 ? 'A nova senha precisa ter pelo menos 8 caracteres.'
  : nova.value !== repetida.value ? 'A confirmação não bate com a nova senha.' : '');

async function salvar() {
  if (problema.value) return;
  enviando.value = true; erro.value = '';
  try { await api.trocarSenha(atual.value, nova.value); senhaAberta.value = false; ui.notify('Senha alterada.'); }
  catch (e) { erro.value = e.message; }
  finally { enviando.value = false; }
}
</script>

<template>
  <div class="ov" v-if="senhaAberta" @click.self="senhaAberta=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sn-t">
      <h3 id="sn-t">Trocar senha</h3>
      <label class="f">Senha atual<input class="input" type="password" v-model="atual" autocomplete="current-password"></label>
      <label class="f">Nova senha (mínimo 8 caracteres)<input class="input" type="password" v-model="nova" autocomplete="new-password"></label>
      <label class="f">Repita a nova senha<input class="input" type="password" v-model="repetida" autocomplete="new-password" @keydown.enter="salvar"></label>
      <div class="tag neg" v-if="erro || (repetida && problema)">{{ erro || problema }}</div>
      <div class="acts"><button class="btn" @click="senhaAberta=false">Cancelar</button><button class="btn primary" :disabled="!!problema || enviando" @click="salvar">Salvar nova senha</button></div>
    </div>
  </div>
</template>
