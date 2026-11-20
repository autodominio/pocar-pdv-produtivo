/* Login com senha no servidor. A sessão fica num cookie HttpOnly e dura 12 horas. */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { VIEWS } from '@/domain/icons';
import { api } from '@/services/api';

export const useSessionStore = defineStore('session', () => {
  const usuario = ref('');           // nome para exibir
  const login = ref('');
  const verificada = ref(false);
  const expirada = ref(false);       // caiu a sessão com o sistema aberto: pede login sem perder o que está na tela
  const admin = ref(false);
  const menus = ref([]);             // menus liberados (o administrador recebe todos)
  const aplicar = r => { usuario.value = r.nome; login.value = r.login; admin.value = !!r.admin; menus.value = r.menus || []; };
  /* Pode abrir o menu? 'usuarios' é só do administrador. O servidor confere de novo em cada operação. */
  const pode = id => id === 'usuarios' ? admin.value : admin.value || menus.value.includes(id);
  const telas = computed(() => VIEWS.filter(v => pode(v.id)));

  async function verificar() {
    try { const r = await api.sessao(); if (r && r.autenticado) aplicar(r); }
    finally { verificada.value = true; }
  }

  async function entrar(l, senha) {
    const r = await api.login(l, senha);
    aplicar(r); expirada.value = false;
    return r;
  }

  const expirou = () => { expirada.value = true; };

  async function sair() {
    try { await api.logout(); } catch (e) { /* a sessão pode já ter expirado */ }
    location.replace(location.pathname);
  }

  return { usuario, login, admin, menus, pode, telas, verificada, expirada, verificar, entrar, expirou, sair };
});
