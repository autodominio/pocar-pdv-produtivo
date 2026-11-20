/* Estado de interface: tela atual (hash), tema, avisos e confirmação de reinício. */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { VIEWS } from '@/domain/icons';
const THEME_KEY = 'pocar-sport-theme';
const TOAST_MS = 3200;

export const useUiStore = defineStore('ui', () => {
  /* ---------- roteamento por hash (#painel, #pdv...) ---------- */
  const readHash = () => { const h = location.hash.replace('#',''); return VIEWS.some(v => v.id === h) ? h : 'painel'; };
  const view = ref(readHash());
  const onHash = () => { view.value = readHash(); window.scrollTo(0,0); };
  const currentView = computed(() => VIEWS.find(v => v.id === view.value));

  /* ---------- tema ---------- */
  const theme = ref((() => { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch(e) { return 'auto'; } })());
  const applyTheme = () => { if (theme.value === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', theme.value); };
  const themeLabel = computed(() => ({ auto: 'automático', light: 'claro', dark: 'escuro' })[theme.value]);
  const toggleTheme = () => { theme.value = { auto: 'dark', dark: 'light', light: 'auto' }[theme.value]; applyTheme(); try { localStorage.setItem(THEME_KEY, theme.value); } catch(e) { /* preferência só na sessão */ } };

  /* ---------- avisos ---------- */
  const toast = ref(''); let toastTimer = null;
  const notify = msg => { toast.value = msg; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.value = '', TOAST_MS); };

  const confirmReset = ref(false);
  const askReset = () => confirmReset.value = true;
  const senhaAberta = ref(false);

  return { view, onHash, currentView, theme, themeLabel, applyTheme, toggleTheme, toast, notify, confirmReset, askReset, senhaAberta };
});
