<!-- Menu inferior (celular). -->
<script setup>
import { storeToRefs } from 'pinia';
import { useUiStore } from '@/stores/ui';
import { useSessionStore } from '@/stores/session';

const { telas: views } = storeToRefs(useSessionStore());
const { view } = storeToRefs(useUiStore());
</script>

<template>
  <nav class="bottomnav">
    <a v-for="v in views" :key="v.id" :href="'#'+v.id" :class="{on:view===v.id}"><span v-html="v.icon"></span>{{ v.short }}</a>
  </nav>
</template>
