/* Usuários e acessos (só administrador): cadastro, menus liberados, senha e ativação. */
import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { VIEWS } from '@/domain/icons';
import { api } from '@/services/api';
import { useDbStore } from './db';
import { useUiStore } from './ui';

/* Menus que podem ser liberados (a tela Usuários é só do administrador). */
export const MENUS_LIBERAVEIS = VIEWS.filter(v => v.id !== 'usuarios');

export const useUsuariosStore = defineStore('usuarios', () => {
  const db = useDbStore(); const ui = useUiStore();
  const lista = ref([]); const carregando = ref(false); const erro = ref('');

  async function carregar() {
    carregando.value = true; erro.value = '';
    try { lista.value = await api.listarUsuarios(); } catch (e) { erro.value = e.message; }
    finally { carregando.value = false; }
  }

  /* modo: 'novo' | 'editar' | 'senha' */
  const form = reactive({ open: false, modo: 'novo', id: null, login: '', nome: '', senha: '', admin: false, menus: [], ativo: true, mostrarSenha: false });
  const abrirNovo = () => Object.assign(form, { open: true, modo: 'novo', id: null, login: '', nome: '', senha: '', admin: false, menus: ['pdv'], ativo: true, mostrarSenha: false });
  const abrirEdicao = u => Object.assign(form, { open: true, modo: 'editar', id: u.id, login: u.login, nome: u.nome, senha: '', admin: u.admin, menus: u.admin ? [] : [...u.menus], ativo: u.ativo });
  const abrirSenha = u => Object.assign(form, { open: true, modo: 'senha', id: u.id, login: u.login, nome: u.nome, senha: '', mostrarSenha: false });
  const alternarMenu = id => { form.menus = form.menus.includes(id) ? form.menus.filter(m => m !== id) : [...form.menus, id]; };

  const formErro = () => {
    if (form.modo === 'senha') return form.senha.length < 8 ? 'A senha precisa ter pelo menos 8 caracteres.' : '';
    if (form.nome.trim().length < 2) return 'Informe o nome.';
    if (form.modo === 'novo' && !/^[a-z0-9._-]{3,40}$/.test(form.login.trim().toLowerCase())) return 'Login de 3 a 40 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.';
    if (form.modo === 'novo' && form.senha.length < 8) return 'A senha inicial precisa ter pelo menos 8 caracteres.';
    if (!form.admin && !form.menus.length) return 'Escolha pelo menos um menu.';
    return '';
  };

  async function salvar() {
    if (formErro()) return;
    let r;
    if (form.modo === 'novo') r = await db.executar(() => api.criarUsuario({ login: form.login.trim().toLowerCase(), nome: form.nome.trim(), senha: form.senha, admin: form.admin, menus: form.menus }), { recarregar: false });
    else if (form.modo === 'editar') r = await db.executar(() => api.editarUsuario(form.id, { nome: form.nome.trim(), admin: form.admin, menus: form.menus, ativo: form.ativo }), { recarregar: false });
    else r = await db.executar(() => api.redefinirSenha(form.id, form.senha), { recarregar: false });
    if (!r) return;
    const msg = form.modo === 'novo' ? `${form.nome.trim()} criado. Já aparece na tela de entrada.` : form.modo === 'senha' ? `Senha de ${form.nome} redefinida.` : 'Usuário atualizado.';
    form.open = false; ui.notify(msg); carregar();
  }

  return { lista, carregando, erro, carregar, form, abrirNovo, abrirEdicao, abrirSenha, alternarMenu, formErro, salvar };
});
