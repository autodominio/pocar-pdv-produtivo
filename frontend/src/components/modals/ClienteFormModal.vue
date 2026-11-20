<!-- Cadastro e edição de cliente. -->
<script setup>
import CampoData from '@/components/form/CampoData.vue';
import { storeToRefs } from 'pinia';
import { brl0, todayIso } from '@/domain/utils';
import { useClientsStore } from '@/stores/clients';
import { useDbStore } from '@/stores/db';

const { cliForm, cliErros } = storeToRefs(useClientsStore());
const { onFone, salvarCliente } = useClientsStore();
const { state } = storeToRefs(useDbStore());
</script>

<template>
  <div class="ov" v-if="cliForm.open" @click.self="cliForm.open=false">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cf-t">
      <h3 id="cf-t">{{ cliForm.id ? 'Editar cliente' : 'Novo cliente' }}</h3>
      <div class="grid g-2" style="gap:12px">
        <label class="f">Nome<input class="input" :class="{bad:cliForm.tentou && cliErros.nome}" v-model="cliForm.nome" autocomplete="given-name"><span class="ferr" v-if="cliForm.tentou && cliErros.nome">{{ cliErros.nome }}</span></label>
        <label class="f">Sobrenome<input class="input" :class="{bad:cliForm.tentou && cliErros.sobrenome}" v-model="cliForm.sobrenome" autocomplete="family-name"><span class="ferr" v-if="cliForm.tentou && cliErros.sobrenome">{{ cliErros.sobrenome }}</span></label>
        <label class="f">Telefone (WhatsApp)<input class="input" :class="{bad:cliForm.tentou && cliErros.telefone}" :value="cliForm.telefone" @input="onFone" inputmode="tel" autocomplete="tel-national" placeholder="(27) 99999-9999"><span class="ferr" v-if="cliForm.tentou && cliErros.telefone">{{ cliErros.telefone }}</span></label>
        <label class="f">Data de nascimento<CampoData :class="{bad:cliForm.tentou && cliErros.nascimento}" :max="todayIso" v-model="cliForm.nascimento" /><span class="ferr" v-if="cliForm.tentou && cliErros.nascimento">{{ cliErros.nascimento }}</span></label>
        <label class="f">Limite de crediário (R$)<input class="input" type="number" min="0" step="50" v-model="cliForm.limite" :placeholder="'Padrão: ' + brl0(state.credCfg.limitePadrao)"></label>
      </div>
      <div class="acts"><button class="btn" @click="cliForm.open=false">Cancelar</button><button class="btn primary" @click="salvarCliente">{{ cliForm.id ? 'Salvar alterações' : 'Cadastrar cliente' }}</button></div>
    </div>
  </div>
</template>
