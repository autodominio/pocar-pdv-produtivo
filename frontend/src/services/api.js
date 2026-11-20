/* Cliente da API. As chamadas vão para /api no próprio endereço do frontend:
   na Vercel, o rewrite do vercel.json repassa para a VPS; em desenvolvimento, o proxy do Vite.
   Sessão: cookie HttpOnly. CSRF: o servidor entrega o token no corpo de /auth/sessao e /auth/login;
   ele fica só em memória e vai no cabeçalho X-XSRF-TOKEN das requisições que alteram dados. */

export class ApiError extends Error {
  constructor(status, corpo) {
    super((corpo && corpo.erro) || `Erro ${status} ao falar com o servidor.`);
    this.status = status; this.corpo = corpo || {};
  }
}

let csrf = '';
const guardarCsrf = r => { if (r && r.csrf) csrf = r.csrf; return r; };

async function pedir(metodo, caminho, corpo, novaTentativa = true) {
  const headers = { Accept: 'application/json' };
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (metodo !== 'GET') headers['X-XSRF-TOKEN'] = csrf;
  let resp;
  try {
    resp = await fetch(caminho, { method: metodo, headers, credentials: 'same-origin', body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  } catch (e) {
    throw new ApiError(0, { erro: 'Sem conexão com o servidor.' });
  }
  const texto = await resp.text();
  let dados = null;
  if (texto) { try { dados = JSON.parse(texto); } catch (e) { dados = null; } }
  // Token CSRF vencido ou ainda não obtido: busca um novo e repete uma vez.
  if (resp.status === 403 && dados && dados.codigo === 'CSRF' && novaTentativa) {
    await pedir('GET', '/api/auth/sessao').then(guardarCsrf);
    return pedir(metodo, caminho, corpo, false);
  }
  if (!resp.ok) throw new ApiError(resp.status, dados);
  return dados;
}

export const api = {
  sessao: () => pedir('GET', '/api/auth/sessao').then(guardarCsrf),
  usuarios: () => pedir('GET', '/api/auth/usuarios'),
  login: (login, senha) => pedir('POST', '/api/auth/login', { login, senha }).then(guardarCsrf),
  logout: () => pedir('POST', '/api/auth/logout', {}),
  trocarSenha: (atual, nova) => pedir('POST', '/api/auth/senha', { atual, nova }),

  // Leitura: tudo que as telas mostram, montado pelo servidor a partir das tabelas.
  loja: () => pedir('GET', '/api/loja'),
  // Escrita: uma rota por operação. As regras rodam no servidor; erro de regra volta como 422 {"erro": "..."}.
  reiniciar: senhaConfirmacao => pedir('POST', '/api/loja/reiniciar', { senhaConfirmacao }),
  registrarTela: (acao, detalhe) => pedir('POST', '/api/loja/registros', { acao, detalhe }),
  novoProduto: p => pedir('POST', '/api/produtos', p),
  entradaMercadoria: p => pedir('POST', '/api/estoque/entradas', p),
  salvarCliente: (id, p) => id ? pedir('PUT', `/api/clientes/${id}`, p) : pedir('POST', '/api/clientes', p),
  abrirCaixa: p => pedir('POST', '/api/caixa/abrir', p),
  movimentoCaixa: p => pedir('POST', '/api/caixa/movimentos', p),
  fecharCaixa: p => pedir('POST', '/api/caixa/fechar', p),
  vender: p => pedir('POST', '/api/vendas', p),
  devolver: (vendaId, p) => pedir('POST', `/api/vendas/${vendaId}/devolucoes`, p),
  cancelar: (vendaId, p) => pedir('POST', `/api/vendas/${vendaId}/cancelamento`, p),
  receberParcela: (credId, n, p) => pedir('POST', `/api/crediarios/${credId}/parcelas/${n}/recebimento`, p),
  lancamento: p => pedir('POST', '/api/lancamentos', p),
  baixar: id => pedir('POST', `/api/lancamentos/${id}/baixa`, {}),
  fecharMes: (mes, obs) => pedir('POST', `/api/fechamentos/${mes}`, { obs }),
  meta: (mes, valor) => pedir('PUT', `/api/metas/${mes}`, { valor }),
  regrasFidelidade: p => pedir('PUT', '/api/config/fidelidade', p),
  regrasCrediario: p => pedir('PUT', '/api/config/crediario', p),
  configEtiquetas: p => pedir('PUT', '/api/config/etiquetas', p),

  despesaFixa: (id, p) => id ? pedir('PUT', `/api/despesas-fixas/${id}`, p) : pedir('POST', '/api/despesas-fixas', p),
  listarUsuarios: () => pedir('GET', '/api/usuarios'),
  criarUsuario: p => pedir('POST', '/api/usuarios', p),
  editarUsuario: (id, p) => pedir('PUT', `/api/usuarios/${id}`, p),
  redefinirSenha: (id, senha) => pedir('POST', `/api/usuarios/${id}/senha`, { senha }),

  auditoria: params => pedir('GET', '/api/auditoria?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))),
  auditoriaUsuarios: () => pedir('GET', '/api/auditoria/usuarios'),
};
