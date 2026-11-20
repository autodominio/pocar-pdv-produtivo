<!-- Volta a loja ao início (produtos e estoque da loja, sem vendas). Exige a senha de quem está logado. -->
<script setup>
import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useDbStore } from '@/stores/db';
import { useUiStore } from '@/stores/ui';
import { usePdvStore } from '@/stores/pdv';

const db = useDbStore(); const ui = useUiStore();
const { confirmReset } = storeToRefs(ui);
const senha = ref(''); const erro = ref(''); const enviando = ref(false);
watch(confirmReset, v => { if (v) { senha.value = ''; erro.value = ''; } });

async function confirmar() {
  enviando.value = true; erro.value = '';
  try {
    await db.reiniciar(senha.value);
    usePdvStore().novaVenda(); confirmReset.value = false;
    ui.notify('Loja reiniciada com os produtos cadastrados.');
  } catch (e) { erro.value = e.message; }
  finally { enviando.value = false; }
}
</script>

<template>
  <div class="ov" v-if="confirmReset" @click.self="confirmReset=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rs-t">
      <div><h3 id="rs-t">Reiniciar os dados</h3><p class="muted" style="margin:4px 0 0">Vendas, financeiro, clientes e caixa são apagados, e o estoque volta aos produtos e quantidades iniciais da loja. Os backups diários do servidor continuam guardados.</p></div>
      <label class="f">Confirme com a sua senha<input class="input" type="password" v-model="senha" autocomplete="current-password" @keydown.enter="senha && confirmar()"></label>
      <div class="tag neg" v-if="erro">{{ erro }}</div>
      <div class="acts"><button class="btn" @click="confirmReset=false">Cancelar</button><button class="btn dark" :disabled="!senha || enviando" @click="confirmar">{{ enviando ? 'Substituindo…' : 'Substituir todos os dados' }}</button></div>
    </div>
  </div>
</template>
