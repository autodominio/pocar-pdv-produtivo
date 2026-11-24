/* Servidor simulado da API, com o mesmo contrato do backend Spring Boot.
   Serve para desenvolver e testar o frontend sem Java nem banco:
     npm run mock        (API em http://localhost:8080; rode "npm run dev" em outro terminal)
   Usuários: MOCK_USUARIOS="login:Nome:senha;..." (padrão: leonardo e admin com senha demo1234).
   Os dados ficam em memória, ou em arquivo se MOCK_ARQUIVO estiver definido.
   As operações reaproveitam as funções de src/domain; quem vale em produção são as regras do backend (Java). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildVazio } from '../src/domain/seed';
import { garantirCodigos } from '../src/domain/etiquetas';
import { financeEntriesFor, calcResultado } from '../src/domain/finance';
import { aplicarFidelidade, beneficiosDe } from '../src/domain/loyalty';
import { criarCrediario, credStatus, planoParcelas } from '../src/domain/credit';
import { marcarLancamentos, caixaAberto, resumoCaixa } from '../src/domain/caixa';
import { registrarDevolucao, criarValeTroca, cancelarVenda, previaDevolucao } from '../src/domain/devolucoes';
import { round2, slug, plusDays, diffDays, isoDate, brl } from '../src/domain/utils';
import { CARD_FEES, CAT_ESTORNO, FORMAS_ESTORNO, PAY_LABEL } from '../src/domain/constants';
import { nomeCompleto } from '../src/domain/clients';

const PORTA = Number(process.env.PORT || 8080);
const ESTATICO = process.env.MOCK_STATIC || '';
const ARQUIVO = process.env.MOCK_ARQUIVO || '';
const PRODUTOS = fileURLToPath(new URL('../../backend/src/main/resources/produtos-iniciais.json', import.meta.url));
const usuarios = (process.env.MOCK_USUARIOS || 'leonardo:Leonardo:demo1234;admin:Administrador:demo1234').split(';')
  .map(x => x.split(':')).map(([login, nome, senha], i) => ({ id: i + 1, login, nome, senha, admin: true, ativo: true, menus: [] }));
const MENUS = ['painel', 'pdv', 'caixa', 'estoque', 'financeiro', 'crediario', 'clientes', 'fidelidade', 'metas', 'auditoria'];
const menusDe = u => u.admin ? MENUS : MENUS.filter(m => u.menus.includes(m));
const sessaoDe = (u, csrf) => ({ autenticado: true, login: u.login, nome: u.nome, csrf, admin: u.admin, menus: menusDe(u) });

const agora = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const hoje = () => agora().slice(0, 10);

function lojaInicial() {
  const db = buildVazio(); db.auditoria = undefined;
  const produtos = fs.existsSync(PRODUTOS) ? JSON.parse(fs.readFileSync(PRODUTOS, 'utf8')) : [];
  db.products = produtos;
  produtos.forEach(p => p.variantes.forEach(v => { if (v.qtd > 0) db.movs.push({ id: db.nextId++, data: agora(), tipo: 'entrada', sku: v.sku, nome: p.nome, var: `${v.tam}, ${v.cor}`, qtd: v.qtd, origem: 'Estoque inicial' }); }));
  garantirCodigos(db);
  db.etiquetasCfg = { folhaId: 'A4351', campos: { nome: true, variacao: true, preco: true, sku: false, codigoBarras: true, loja: false }, ajusteX: 0, ajusteY: 0 };
  db.seqProduto = 1; db.despesasFixas = [];
  return db;
}
let banco = { loja: lojaInicial(), auditoria: [], seq: 1 };
if (ARQUIVO && fs.existsSync(ARQUIVO)) banco = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
const gravar = () => { if (ARQUIVO) fs.writeFileSync(ARQUIVO, JSON.stringify(banco)); };
const sessoes = new Map(); const falhas = new Map();
const auditar = (u, acao, detalhe) => banco.auditoria.push({ id: banco.seq++, quando: agora(), usuario: u.nome, login: u.login, acao: String(acao).slice(0, 120), detalhe: String(detalhe || '').slice(0, 2000) });

const cookies = req => Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map(c => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
const json = (res, status, corpo) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(corpo === undefined ? '' : JSON.stringify(corpo)); };
const corpo = req => new Promise(ok => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { ok(null); } }); });
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

class Regra extends Error {}
const exigir = (cond, msg) => { if (!cond) throw new Regra(msg); };

/* Fotografia no mesmo formato do GET /api/loja do backend. */
function fotografia() {
  const { auditoria, nextId, nextCodigo, seqProduto, v, ...resto } = banco.loja;
  return { ...resto, movs: banco.loja.movs.slice(-50) };
}

/* ---------- operações (mesmo contrato do backend) ---------- */
function operacao(rota, b, u, params) {
  const db = banco.loja; const ids = () => db.nextId++;
  const cx = caixaAberto(db);
  const ctx = { ids, usuario: u.nome, agora: agora(), hoje: hoje(), caixaId: cx ? cx.id : null };
  const reg = (acao, detalhe) => auditar(u, acao, detalhe);
  const venda = id => { const s = db.sales.find(x => x.id === Number(id)); exigir(s, 'Venda não encontrada.'); return s; };

  switch (rota) {
    case 'POST /api/loja/registros': reg(b.acao, b.detalhe); return { ok: true };
    case 'POST /api/produtos': {
      exigir(b.nome && b.categoria && b.preco > 0 && b.tamanhos?.length && b.cores?.length, 'Preencha nome, categoria, preço, tamanhos e cores.');
      const id = 'PS' + String(db.seqProduto++).padStart(3, '0');
      db.products.push({ id, nome: b.nome, categoria: b.categoria, preco: b.preco, custo: b.custo || 0,
        variantes: b.tamanhos.flatMap(t => b.cores.map(cor => ({ sku: `${id}-${t === 'Único' ? 'U' : t}-${slug(cor)}`, tam: t, cor, qtd: 0, min: b.minimo || 0 }))) });
      const codigos = garantirCodigos(db); reg('Produto cadastrado', `${id} ${b.nome}, ${brl(b.preco)}`); return { id, codigos };
    }
    case 'PUT /api/produtos': {
      const p = db.products.find(x => x.id === params.codigo); exigir(p, 'Produto não encontrado.');
      const nome = (b.nome || '').trim(), categoria = (b.categoria || '').trim(), preco = round2(b.preco || 0), custo = round2(b.custo || 0);
      exigir(nome, 'Informe o nome do produto.'); exigir(categoria, 'Informe a categoria.'); exigir(preco > 0, 'Informe o preço de venda.');
      exigir(custo >= 0, 'O custo não pode ser negativo.'); exigir(b.minimo == null || b.minimo >= 0, 'O estoque mínimo não pode ser negativo.');
      const mud = [];
      if (nome !== p.nome) mud.push(`nome: ${p.nome} → ${nome}`);
      if (categoria !== p.categoria) mud.push(`categoria: ${p.categoria} → ${categoria}`);
      if (preco !== p.preco) mud.push(`preço: ${brl(p.preco)} → ${brl(preco)}`);
      if (custo !== p.custo) mud.push(`custo: ${brl(p.custo)} → ${brl(custo)}`);
      if (b.minimo != null && p.variantes.some(v => v.min !== b.minimo)) { mud.push(`estoque mínimo: ${b.minimo} em todas as variações`); p.variantes.forEach(v => { v.min = b.minimo; }); }
      if (mud.length) { Object.assign(p, { nome, categoria, preco, custo }); reg('Produto alterado', `${p.id} ${nome}: ${mud.join('; ')}`); }
      return { ok: true };
    }
    case 'POST /api/estoque/entradas': {
      exigir(b.qtd > 0, 'Informe a quantidade que chegou.');
      let sku = b.sku; const nova = !sku && !!b.produto;
      if (nova) {
        const p = db.products.find(x => x.id === b.produto); exigir(p, 'Produto não encontrado.');
        let tam = (b.tamanho || '').trim(); const cor = (b.cor || '').trim();
        exigir(tam && cor, 'Informe o tamanho e a cor da nova variação.');
        tam = /^[uú]nico$/i.test(tam) ? 'Único' : tam.toUpperCase();
        exigir(/^[\p{L}\p{N}]{1,10}$/u.test(tam), 'O tamanho deve ter só letras e números (até 10), como G, GG, 38 ou Único.');
        exigir(slug(cor), 'A cor precisa ter letras.');
        exigir(!p.variantes.some(v => v.tam.toLowerCase() === tam.toLowerCase() && v.cor.toLowerCase() === cor.toLowerCase()), 'Esta variação já existe. Escolha-a na lista.');
        sku = `${p.id}-${tam === 'Único' ? 'U' : tam}-${slug(cor)}`;
        exigir(!p.variantes.some(v => v.sku === sku), `A cor "${cor}" gera o mesmo código de outra cor parecida deste produto. Diferencie o nome da cor.`);
        const mins = p.variantes.map(v => v.min); const min = mins.sort((a, c) => mins.filter(x => x === c).length - mins.filter(x => x === a).length || a - c)[0] ?? 0;
        p.variantes.push({ sku, tam, cor, qtd: 0, min }); garantirCodigos(db);
        reg('Variação cadastrada', `${p.id} ${p.nome}: ${tam}, ${cor} (código de barras ${p.variantes.at(-1).codigoBarras})`);
      }
      const p = db.products.find(x => x.variantes.some(v => v.sku === sku)); exigir(p, 'Variação de produto não encontrada.');
      const v = p.variantes.find(x => x.sku === sku); v.qtd += b.qtd;
      db.movs.push({ id: ids(), data: agora(), tipo: 'entrada', sku: v.sku, nome: p.nome, var: `${v.tam}, ${v.cor}`, qtd: b.qtd, origem: b.fornecedor || 'Fornecedor' });
      if (b.gerarConta && b.custo > 0) db.lanc.push({ id: ids(), data: b.venc, origem: 'Estoque', tipo: 'despesa', categoria: 'Fornecedores', descricao: `${p.nome} ${v.tam} x${b.qtd}${b.fornecedor ? ' (' + b.fornecedor + ')' : ''}`, valor: round2(b.qtd * b.custo), venc: b.venc, status: 'pendente', pagoEm: null });
      reg('Entrada de mercadoria', `${b.qtd}x ${p.nome} ${v.tam} ${v.cor}`); return { sku, codigoBarras: v.codigoBarras, tamanho: v.tam, cor: v.cor, variacaoNova: nova };
    }
    case 'POST /api/clientes': case 'PUT /api/clientes': {
      const id = params.id ? Number(params.id) : null;
      const dup = db.clientes.find(c => c.telefone === b.telefone && c.id !== id); exigir(!dup, dup ? `Este telefone já é de ${nomeCompleto(dup)}.` : '');
      let c; if (id) { c = db.clientes.find(x => x.id === id); exigir(c, 'Cliente não encontrado.'); Object.assign(c, b); }
      else { c = { id: ids(), ...b, criadoEm: hoje() }; db.clientes.push(c); }
      reg(id ? 'Cadastro de cliente alterado' : 'Cliente cadastrado', nomeCompleto(c)); return { id: c.id };
    }
    case 'POST /api/caixa/abrir': {
      exigir(!cx, 'Já existe um caixa aberto.');
      const novo = { id: ids(), abertoEm: agora(), abertoPor: u.nome, valorInicial: round2(b.valor), obsAbertura: b.obs || '', movs: [], fechadoEm: null };
      db.caixas.push(novo); reg('Caixa aberto', `Troco inicial de ${brl(novo.valorInicial)}`); return { id: novo.id };
    }
    case 'POST /api/caixa/movimentos': {
      exigir(cx, 'Abra o caixa primeiro.'); exigir(b.tipo !== 'sangria' || b.valor <= resumoCaixa(db, cx).esperado, `A gaveta tem ${brl(resumoCaixa(db, cx).esperado)} em dinheiro.`);
      cx.movs.push({ id: ids(), quando: agora(), tipo: b.tipo, valor: round2(b.valor), motivo: b.motivo, usuario: u.nome });
      reg(b.tipo === 'sangria' ? 'Removido do caixa' : 'Adicionado ao caixa', `${brl(b.valor)}. ${b.motivo}`); return { ok: true };
    }
    case 'POST /api/caixa/fechar': {
      exigir(cx, 'Não há caixa aberto.'); const esperado = resumoCaixa(db, cx).esperado; const diferenca = round2(b.contado - esperado);
      exigir(!diferenca || b.obs, 'Explique a diferença no campo de observação.');
      Object.assign(cx, { fechadoEm: agora(), fechadoPor: u.nome, esperado, contado: round2(b.contado), diferenca, obs: b.obs || '' });
      reg('Caixa fechado', `Esperado ${brl(esperado)}, contado ${brl(b.contado)}`); return { ok: true };
    }
    case 'POST /api/vendas': return vender(db, b, u, ctx, cx, reg);
    case 'POST /api/vendas/devolucoes': {
      const s = venda(params.id);
      const d = registrarDevolucao(db, s, { qtds: b.qtds, destino: 'estorno', forma: b.forma, motivo: b.motivo }, ctx);
      const resumo = [d.abatido > 0 ? `${brl(d.abatido)} abatidos das parcelas/recebíveis` : '', d.estornado > 0 ? `${brl(d.estornado)} devolvidos (${FORMAS_ESTORNO[d.forma]})` : ''].filter(Boolean).join(' e ');
      reg('Devolução', `Venda #${s.id}. ${resumo}. Motivo: ${b.motivo}`); return { abatido: d.abatido, estornado: d.estornado, resumo };
    }
    case 'POST /api/vendas/cancelamento': {
      const s = venda(params.id); exigir(String(b.motivo || '').trim().length >= 3, 'Informe o motivo do cancelamento.');
      const prev = cancelarVenda(db, s, { forma: b.forma, motivo: b.motivo }, ctx);
      reg('Venda cancelada', `Venda #${s.id} de ${brl(s.total)}. Motivo: ${b.motivo}`); return { estornado: prev.jaRecebido, pendenteCancelado: prev.pendenteCancelado };
    }
    case 'POST /api/crediarios/recebimento': {
      const cr = db.crediarios.find(c => String(c.id) === params.id); const p = cr && cr.parcelas.find(x => x.n === Number(params.n));
      exigir(p && !p.pagoEm, 'Parcela não encontrada ou já recebida.'); exigir(b.forma !== 'dinheiro' || cx, 'Abra o caixa para receber em dinheiro.');
      const dias = Math.max(0, diffDays(hoje(), p.venc)); const multa = dias > 0 ? round2(p.valor * db.credCfg.multa / 100) : 0;
      const juros = dias > 0 ? round2(p.valor * db.credCfg.jurosMes / 100 * dias / 30) : 0; const encargos = b.cobrarEncargos === false ? 0 : round2(multa + juros);
      const total = round2(p.valor + encargos); const caixaId = cx ? cx.id : null;
      Object.assign(p, { pagoEm: hoje(), valorPago: total, forma: b.forma });
      const l = db.lanc.find(x => x.credId === cr.id && x.parcela === p.n); if (l) Object.assign(l, { status: 'pago', pagoEm: hoje(), forma: b.forma, caixaId });
      if (encargos > 0) db.lanc.push({ id: ids(), data: hoje(), origem: 'Crediário', credId: cr.id, tipo: 'receita', categoria: 'Juros e multa (crediário)', descricao: `Juros e multa, parcela ${p.n}/${cr.parcelas.length} da venda #${cr.vendaId}`, valor: encargos, venc: hoje(), status: 'pago', pagoEm: hoje(), forma: b.forma, caixaId });
      const taxa = round2(total * (CARD_FEES[b.forma] || 0));
      if (taxa > 0) db.lanc.push({ id: ids(), data: hoje(), origem: 'Crediário', tipo: 'despesa', categoria: 'Taxas de cartão', descricao: `Taxa ${PAY_LABEL[b.forma].toLowerCase()}, parcela ${p.n} da venda #${cr.vendaId}`, valor: taxa, venc: hoje(), status: 'pago', pagoEm: hoje(), forma: b.forma, caixaId });
      const c = db.clientes.find(x => x.id === cr.clienteId); const nome = c ? nomeCompleto(c) : 'Cliente';
      reg('Parcela recebida', `${nome}, parcela ${p.n}/${cr.parcelas.length}: ${brl(total)}`); return { total, encargos, nome, n: p.n, qtd: cr.parcelas.length };
    }
    case 'POST /api/lancamentos': {
      exigir(b.descricao && b.valor > 0 && b.venc, 'Preencha descrição, valor e vencimento.');
      const l = { id: ids(), data: b.venc, origem: 'Manual', tipo: b.tipo, categoria: b.categoria, descricao: b.descricao, valor: round2(b.valor), venc: b.venc, status: b.status, pagoEm: b.status === 'pago' ? b.venc : null };
      db.lanc.push(l); reg('Lançamento criado', `${b.descricao}, ${brl(b.valor)}`); return { id: l.id };
    }
    case 'POST /api/lancamentos/baixa': {
      const l = db.lanc.find(x => x.id === Number(params.id)); exigir(l && l.status === 'pendente', 'Esta conta não está em aberto.');
      Object.assign(l, { status: 'pago', pagoEm: hoje() }); reg(l.tipo === 'despesa' ? 'Conta paga' : 'Conta recebida', `${l.descricao}, ${brl(l.valor)}`); return { ok: true };
    }
    case 'POST /api/fechamentos': { db.fechamentos[params.mes] = { ...calcResultado(db, params.mes), fechadoEm: hoje(), obs: b.obs || '' }; reg('Mês fechado', params.mes); return { ok: true }; }
    case 'PUT /api/metas': { exigir(b.valor > 0, 'Informe a meta do mês.'); db.metas[params.mes] = b.valor; reg('Metas alteradas', `Meta da loja: ${brl(b.valor)}`); return { ok: true }; }
    case 'PUT /api/config/fidelidade': db.fid = { ...db.fid, ...b }; reg('Regras de fidelidade alteradas', ''); return { ok: true };
    case 'PUT /api/config/crediario': db.credCfg = { ...db.credCfg, ...b }; reg('Regras do crediário alteradas', ''); return { ok: true };
    case 'PUT /api/config/etiquetas': db.etiquetasCfg = b; return { ok: true };
    case 'POST /api/despesas-fixas': case 'PUT /api/despesas-fixas': {
      exigir(b.descricao && b.valor > 0 && b.dia >= 1 && b.dia <= 31, 'Preencha descrição, valor e dia (1 a 31).');
      const atual = hoje().slice(0, 7);
      if (!params.id) { const venceu = Number(hoje().slice(8)) > b.dia; const [y, m] = atual.split('-').map(Number);
        const inicio = venceu ? (m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`) : atual;
        const d = { id: ids(), descricao: b.descricao, categoria: b.categoria, valor: round2(b.valor), dia: b.dia, ativa: true, inicio };
        db.despesasFixas.push(d); gerarContasFixas(db); reg('Despesa fixa criada', `${d.descricao}: ${brl(d.valor)} todo dia ${d.dia}`); return { id: d.id }; }
      const d = db.despesasFixas.find(x => x.id === Number(params.id)); exigir(d, 'Despesa fixa não encontrada.');
      Object.assign(d, { descricao: b.descricao, categoria: b.categoria, valor: round2(b.valor), dia: b.dia, ativa: b.ativa !== false });
      db.lanc.filter(l => l.despesaFixaId === d.id && l.competencia >= atual && l.status !== 'pago').forEach(l => { l.status = d.ativa ? 'pendente' : 'cancelado'; l.valor = d.valor; });
      gerarContasFixas(db); reg(d.ativa ? 'Despesa fixa alterada' : 'Despesa fixa desativada', d.descricao); return { id: d.id };
    }
    default: return undefined;
  }
}

function vender(db, b, u, ctx, cx, reg) {
  exigir(cx, 'Abra o caixa para começar a vender.'); exigir(b.itens?.length, 'O carrinho está vazio.');
  const variante = sku => { for (const p of db.products) { const v = p.variantes.find(x => x.sku === sku); if (v) return { p, v }; } return null; };
  let devTroca = null; let creditoTroca = 0;
  if (b.troca) { const orig = db.sales.find(s => s.id === b.troca.vendaId); creditoTroca = previaDevolucao(orig, b.troca.qtds).valor;
    devTroca = registrarDevolucao(db, orig, { qtds: b.troca.qtds, destino: 'troca', motivo: b.troca.motivo }, ctx); }
  const itens = b.itens.map(i => { const h = variante(i.sku); exigir(h, 'Produto não encontrado.'); exigir(h.v.qtd >= i.qtd, `Estoque insuficiente de ${h.p.nome} ${h.v.tam}.`);
    return { sku: i.sku, pid: h.p.id, nome: h.p.nome, tam: h.v.tam, cor: h.v.cor, preco: h.p.preco, custo: h.p.custo, qtd: i.qtd }; });
  const subtotal = round2(itens.reduce((t, i) => t + i.preco * i.qtd, 0));
  exigir(b.descontoTipo !== '%' || (b.desconto || 0) <= 30, 'Desconto acima de 30% precisa de aprovação do gerente.');
  const desconto = round2(Math.min(subtotal, b.descontoTipo === '%' ? subtotal * (b.desconto || 0) / 100 : (b.desconto || 0)));
  const ben = b.clienteId ? beneficiosDe(db, b.clienteId, ctx.hoje) : { vales: [], cashSaldo: 0 };
  const aposDesc = round2(subtotal - desconto);
  const vale = round2(Math.min(ben.vales.filter(v => (b.valesIds || []).includes(v.id)).reduce((t, v) => t + v.valor, 0), aposDesc));
  const cash = b.usarCashback ? round2(Math.min(ben.cashSaldo, aposDesc - vale)) : 0;
  const troca = round2(Math.max(0, Math.min(creditoTroca, aposDesc - vale - cash)));
  const total = round2(aposDesc - vale - cash - troca);
  if (b.pagamento === 'crediario') { const c = db.clientes.find(x => x.id === b.clienteId); exigir(c, 'Selecione o cliente para vender no crediário.');
    exigir(round2(total - (b.crediario.entrada || 0)) <= credStatus(db, c, ctx.hoje).disponivel + 0.001, 'Valor parcelado acima do limite disponível.'); }
  const sale = { id: db.nextSale++, data: ctx.agora, vendedor: u.nome, clienteId: b.clienteId, itens, subtotal, desconto, valesIds: b.valesIds || [], valeUsado: vale, cashbackUsado: cash, total,
    pagamento: b.pagamento, parcelas: b.pagamento === 'crediario' ? b.crediario.parcelas : (b.parcelas || 1), entrada: b.pagamento === 'crediario' ? round2(b.crediario.entrada || 0) : 0,
    entradaForma: b.crediario?.entradaForma || null, status: 'concluida', caixaId: cx.id, registradoPor: u.nome, creditoTroca: troca, trocaDe: b.troca ? b.troca.vendaId : null };
  itens.forEach(i => { variante(i.sku).v.qtd -= i.qtd; db.movs.push({ id: ctx.ids(), data: sale.data, tipo: 'saida', sku: i.sku, nome: i.nome, var: `${i.tam}, ${i.cor}`, qtd: i.qtd, origem: `Venda #${sale.id}` }); });
  db.sales.push(sale);
  const entries = financeEntriesFor(sale, ctx.ids, ctx.hoje); marcarLancamentos(entries, cx.id, sale.pagamento); db.lanc.push(...entries);
  let cred = null;
  if (sale.pagamento === 'crediario') { const c = db.clientes.find(x => x.id === sale.clienteId);
    const novo = criarCrediario(sale, sale.entrada, sale.entradaForma, b.crediario.primeiroVenc, ctx.ids, nomeCompleto(c));
    marcarLancamentos(novo.lancs, cx.id, sale.entradaForma); db.crediarios.push(novo.cred); db.lanc.push(...novo.lancs); entries.push(...novo.lancs); cred = novo.cred; }
  const ganhos = aplicarFidelidade(db, sale, ctx.ids);
  let sobra = null; const resto = round2(creditoTroca - troca);
  if (b.troca && resto > 0) {
    if (b.troca.sobraDestino === 'vale') { criarValeTroca(db, sale.clienteId, resto, sale.id, ctx); sobra = { valor: resto, vale: true }; }
    else { db.lanc.push({ id: ctx.ids(), data: ctx.hoje, origem: 'Devolução', vendaId: b.troca.vendaId, tipo: 'despesa', categoria: CAT_ESTORNO, descricao: `Sobra da troca da venda #${b.troca.vendaId}`, valor: resto, venc: ctx.hoje, status: 'pago', pagoEm: ctx.hoje, forma: b.troca.sobraDestino, caixaId: cx.id });
      devTroca.sobraEstornada = resto; sobra = { valor: resto, forma: b.troca.sobraDestino }; }
  }
  const c = db.clientes.find(x => x.id === sale.clienteId);
  reg('Venda registrada', `Venda #${sale.id}: ${brl(total)} (${sale.pagamento})`);
  return { ...sale, troco: sale.pagamento === 'dinheiro' ? round2((b.recebido || 0) - total) : 0, lancs: entries.length, clienteNome: c ? nomeCompleto(c) : '',
    ganhos: { cashback: ganhos.cashback, cashValidade: ganhos.cashValidade, vale: ganhos.vale ? { valor: ganhos.vale.valor, validade: ganhos.vale.validade } : null },
    cred: cred ? { entrada: cred.entrada, parcelas: cred.parcelas.map(({ n, valor, venc }) => ({ n, valor, venc })) } : null, sobra };
}

/* Menus exigidos por operação (o mesmo que o backend confere). */
const PERMISSOES = {
  'POST /api/produtos': ['estoque'], 'PUT /api/produtos': ['estoque'], 'POST /api/estoque/entradas': ['estoque'], 'PUT /api/config/etiquetas': ['estoque'],
  'POST /api/clientes': ['clientes', 'pdv'], 'PUT /api/clientes': ['clientes'],
  'POST /api/caixa/abrir': ['caixa', 'pdv'], 'POST /api/caixa/movimentos': ['caixa'], 'POST /api/caixa/fechar': ['caixa'],
  'POST /api/vendas': ['pdv'], 'POST /api/vendas/devolucoes': ['caixa'], 'POST /api/vendas/cancelamento': ['caixa'],
  'POST /api/crediarios/recebimento': ['crediario', 'financeiro'], 'POST /api/lancamentos': ['financeiro'], 'POST /api/lancamentos/baixa': ['financeiro'],
  'POST /api/fechamentos': ['financeiro'], 'POST /api/despesas-fixas': ['financeiro'], 'PUT /api/despesas-fixas': ['financeiro'],
  'PUT /api/metas': ['metas'], 'PUT /api/config/fidelidade': ['fidelidade'], 'PUT /api/config/crediario': ['crediario'],
};

/* Despesas fixas: conta do mês atual e do próximo, uma vez só (como o DespesaFixaService do backend). */
function gerarContasFixas(db) {
  const atual = hoje().slice(0, 7); const prox = (() => { const [y, m] = atual.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; })();
  for (const d of db.despesasFixas.filter(x => x.ativa)) for (const mes of [atual, prox]) {
    if (mes < d.inicio || db.lanc.some(l => l.despesaFixaId === d.id && l.competencia === mes)) continue;
    const [y, m] = mes.split('-').map(Number); const venc = `${mes}-${String(Math.min(d.dia, new Date(y, m, 0).getDate())).padStart(2, '0')}`;
    db.lanc.push({ id: db.nextId++, data: venc, origem: 'Despesa fixa', tipo: 'despesa', categoria: d.categoria, descricao: `${d.descricao} (${mes.slice(5)}/${mes.slice(0, 4)})`, valor: d.valor, venc, status: 'pendente', pagoEm: null, despesaFixaId: d.id, competencia: mes });
  }
}

/* Rotas com parâmetros: /api/clientes/5 -> 'PUT /api/clientes' + { id: '5' } */
const ROTAS = [
  [/^\/api\/produtos\/([^/]+)$/, '/api/produtos', ['codigo']],
  [/^\/api\/clientes\/(\d+)$/, '/api/clientes', ['id']],
  [/^\/api\/vendas\/(\d+)\/devolucoes$/, '/api/vendas/devolucoes', ['id']],
  [/^\/api\/vendas\/(\d+)\/cancelamento$/, '/api/vendas/cancelamento', ['id']],
  [/^\/api\/crediarios\/([^/]+)\/parcelas\/(\d+)\/recebimento$/, '/api/crediarios/recebimento', ['id', 'n']],
  [/^\/api\/lancamentos\/(\d+)\/baixa$/, '/api/lancamentos/baixa', ['id']],
  [/^\/api\/fechamentos\/(\d{4}-\d{2})$/, '/api/fechamentos', ['mes']],
  [/^\/api\/metas\/(\d{4}-\d{2})$/, '/api/metas', ['mes']],
  [/^\/api\/despesas-fixas\/(\d+)$/, '/api/despesas-fixas', ['id']],
];
function rotear(metodo, caminho) {
  for (const [re, nome, campos] of ROTAS) { const m = caminho.match(re); if (m) return { rota: `${metodo} ${nome}`, params: Object.fromEntries(campos.map((c, i) => [c, m[i + 1]])) }; }
  return { rota: `${metodo} ${caminho}`, params: {} };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'); const ck = cookies(req);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const novosCookies = [];
  let xsrf = ck['XSRF-TOKEN'];
  if (!xsrf) { xsrf = crypto.randomUUID(); novosCookies.push(`XSRF-TOKEN=${xsrf}; Path=/; HttpOnly; SameSite=Lax`); }
  const setCookies = () => { if (novosCookies.length) res.setHeader('Set-Cookie', novosCookies); };

  if (!url.pathname.startsWith('/api/')) {
    if (!ESTATICO) return json(res, 404, { erro: 'Não encontrado' });
    const arq = path.join(ESTATICO, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
    if (!fs.existsSync(arq) || fs.statSync(arq).isDirectory()) return json(res, 404, { erro: 'Não encontrado' });
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' }); return fs.createReadStream(arq).pipe(res);
  }

  setCookies();
  if (req.method !== 'GET' && (!ck['XSRF-TOKEN'] || req.headers['x-xsrf-token'] !== ck['XSRF-TOKEN'])) return json(res, 403, { erro: 'Sessão de segurança expirada. Tente de novo.', codigo: 'CSRF' });
  const login = sessoes.get(ck.POCAR_SESSAO); const usuario = usuarios.find(u => u.login === login && u.ativo);
  const rota = `${req.method} ${url.pathname}`;

  if (rota === 'GET /api/auth/usuarios') return json(res, 200, usuarios.filter(u => u.ativo).map(({ login, nome }) => ({ login, nome })));
  if (rota === 'GET /api/auth/sessao') return json(res, 200, usuario ? sessaoDe(usuario, xsrf) : { autenticado: false, csrf: xsrf });
  if (rota === 'POST /api/auth/login') {
    const b = await corpo(req); const l = String(b?.login || '').toLowerCase(); const f = falhas.get(l) || { n: 0, ate: 0 };
    if (f.ate > Date.now()) return json(res, 429, { erro: 'Muitas tentativas erradas. Aguarde 5 minutos e tente de novo.' });
    const u = usuarios.find(x => x.login === l && x.senha === b?.senha && x.ativo);
    if (!u) { const n = f.ate && f.ate <= Date.now() ? 1 : f.n + 1; falhas.set(l, { n, ate: n >= 5 ? Date.now() + 300000 : 0 });
      const existe = usuarios.find(x => x.login === l); if (existe) auditar(existe, 'Tentativa de login com senha errada', '', null); gravar();
      return json(res, 401, { erro: 'Usuário ou senha incorretos.' }); }
    falhas.delete(l); const sid = crypto.randomUUID(); sessoes.set(sid, u.login);
    novosCookies.push(`POCAR_SESSAO=${sid}; Path=/; HttpOnly; SameSite=Lax`); setCookies(); auditar(u, 'Entrou no sistema', '', null); gravar();
    return json(res, 200, sessaoDe(u, xsrf));
  }
  if (!usuario) return json(res, 401, { erro: 'Faça login para continuar.' });

  /* ---------- usuários (só administrador) ---------- */
  const mUsuario = url.pathname.match(/^\/api\/usuarios(?:\/(\d+)(\/senha)?)?$/);
  if (mUsuario) {
    if (!usuario.admin) return json(res, 403, { erro: 'Só o administrador pode fazer isso.' });
    const lista = () => usuarios.map(u => ({ id: u.id, login: u.login, nome: u.nome, ativo: u.ativo, admin: u.admin, menus: menusDe(u) }));
    if (req.method === 'GET') return json(res, 200, lista());
    const b = await corpo(req) || {};
    const alvo = mUsuario[1] ? usuarios.find(u => u.id === Number(mUsuario[1])) : null;
    if (req.method === 'POST' && !mUsuario[1]) {
      if (usuarios.some(u => u.login === b.login)) return json(res, 422, { erro: `Já existe um usuário com o login "${b.login}".` });
      if (!b.admin && !(b.menus || []).length) return json(res, 422, { erro: 'Escolha pelo menos um menu para o usuário.' });
      const novo = { id: Math.max(...usuarios.map(u => u.id)) + 1, login: b.login, nome: b.nome, senha: b.senha, admin: !!b.admin, ativo: true, menus: b.admin ? [] : b.menus };
      usuarios.push(novo); auditar(usuario, 'Usuário criado', `${novo.nome} (${novo.login})`); return json(res, 200, { id: novo.id });
    }
    if (!alvo) return json(res, 422, { erro: 'Usuário não encontrado.' });
    if (req.method === 'POST' && mUsuario[2]) { alvo.senha = b.senha; auditar(usuario, 'Senha redefinida', alvo.nome); return json(res, 200, { ok: true }); }
    if (req.method === 'PUT') {
      if (alvo.id === usuario.id && (!b.admin || b.ativo === false)) return json(res, 422, { erro: 'Você não pode tirar o seu próprio acesso de administrador nem se desativar.' });
      Object.assign(alvo, { nome: b.nome, admin: !!b.admin, ativo: b.ativo !== false, menus: b.admin ? [] : (b.menus || []) });
      auditar(usuario, 'Usuário alterado', alvo.nome); return json(res, 200, { ok: true });
    }
  }

  if (rota === 'POST /api/auth/logout') { auditar(usuario, 'Saiu do sistema', '', null); sessoes.delete(ck.POCAR_SESSAO); gravar(); return json(res, 204); }
  if (rota === 'POST /api/auth/senha') { const b = await corpo(req);
    if (b?.atual !== usuario.senha) return json(res, 422, { erro: 'A senha atual não confere.' });
    if (!b?.nova || b.nova.length < 8) return json(res, 400, { erro: 'Requisição inválida.' });
    usuario.senha = b.nova; auditar(usuario, 'Senha alterada', '', null); gravar(); return json(res, 204); }
  if (rota === 'GET /api/loja') { banco.loja.despesasFixas ||= []; gerarContasFixas(banco.loja); return json(res, 200, fotografia()); }
  if (rota === 'POST /api/loja/reiniciar') { const b = await corpo(req);
    if (!usuario.admin) return json(res, 403, { erro: 'Só o administrador pode fazer isso.' });
    if (b?.senhaConfirmacao !== usuario.senha) return json(res, 403, { erro: 'Senha incorreta. Para substituir todos os dados, confirme com a sua senha.' });
    banco.loja = lojaInicial(); auditar(usuario, 'Loja reiniciada com os produtos cadastrados', ''); gravar(); return json(res, 200, { ok: true }); }
  {
    const b = req.method === 'GET' ? {} : await corpo(req); if (b === null) return json(res, 400, { erro: 'Requisição inválida.' });
    const { rota: r, params } = rotear(req.method, url.pathname);
    const exige = PERMISSOES[r];
    if (exige && !usuario.admin && !exige.some(m => usuario.menus.includes(m))) return json(res, 403, { erro: 'Seu usuário não tem acesso a esta área. Peça ao administrador.' });
    try {
      const resultado = operacao(r, b, usuario, params);
      if (resultado !== undefined) { gravar(); return json(res, 200, resultado); }
    } catch (e) {
      if (e instanceof Regra || e.message) return json(res, 422, { erro: e.message });
      throw e;
    }
  }
  if (rota === 'GET /api/auditoria') {
    const p = Object.fromEntries(url.searchParams); const limite = Math.min(Number(p.limite || 100), 500);
    const dias = { hoje: 0, '7d': 6, '30d': 29 }[p.periodo || '7d']; let desde = '';
    if (dias !== undefined) { const d = new Date(); d.setDate(d.getDate() - dias); desde = agora().slice(0, 0) + d.toISOString().slice(0, 10); }
    const sem = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); const q = p.busca ? sem(p.busca) : '';
    const lista = banco.auditoria.filter(a => (!p.usuario || a.usuario === p.usuario) && (!desde || a.quando >= desde) && (!q || sem(a.acao + ' ' + a.detalhe).includes(q)) && (!p.antesDe || a.id < Number(p.antesDe)))
      .sort((a, b) => b.id - a.id);
    return json(res, 200, { registros: lista.slice(0, limite).map(({ id, quando, usuario, acao, detalhe }) => ({ id, quando, usuario, acao, detalhe })), temMais: lista.length > limite });
  }
  if (rota === 'GET /api/auditoria/usuarios') return json(res, 200, [...new Set(banco.auditoria.map(a => a.usuario))].sort());
  return json(res, 404, { erro: 'Não encontrado' });
}).listen(PORTA, () => console.log(`API simulada em http://localhost:${PORTA}${ESTATICO ? ` (servindo ${ESTATICO})` : ''}`));
