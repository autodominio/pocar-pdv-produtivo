<!-- Campo de data sempre em DD/MM/AAAA, seja qual for o idioma do navegador (o type="date" segue o navegador).
     v-model recebe e devolve AAAA-MM-DD; enquanto a data estiver incompleta ou inválida, devolve "". -->
<script setup>
import { computed, ref, watch } from 'vue';
import { brParaIso, isoParaBr, mascaraData } from '@/domain/datas';

const props = defineProps({ modelValue: { type: String, default: '' }, min: String, max: String });
const emit = defineEmits(['update:modelValue']);

const texto = ref(isoParaBr(props.modelValue));
watch(() => props.modelValue, v => { if ((brParaIso(texto.value) || '') !== (v || '')) texto.value = isoParaBr(v); });

const iso = computed(() => brParaIso(texto.value));
const invalido = computed(() => texto.value.length === 10 &&
  (!iso.value || (props.min && iso.value < props.min) || (props.max && iso.value > props.max)));

const digitar = e => {
  texto.value = mascaraData(e.target.value);
  e.target.value = texto.value;
  emit('update:modelValue', iso.value || '');
};
</script>

<template>
  <input class="input" :class="{ bad: invalido }" type="text" inputmode="numeric" autocomplete="off"
         placeholder="DD/MM/AAAA" maxlength="10" :value="texto" @input="digitar">
</template>
