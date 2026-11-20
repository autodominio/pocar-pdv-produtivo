/* Dados de demonstração (catálogo, clientes, ~70 dias de vendas, despesas, fidelidade e crediário). */
import { CATALOG, FIXED_EXPENSES, DEFAULT_MIN_STOCK, SEED_DAYS } from './constants';
import { round2, pad, isoDate, isoDateTime, addDays, startOfToday, slug, daysInMonth, shiftMonth, prng, addMonthsIso } from './utils';
import { financeEntriesFor, calcResultado } from './finance';
import { DEFAULT_FID, beneficiosDe, aplicarFidelidade } from './loyalty';
import { DEFAULT_CRED, criarCrediario } from './credit';
import { seedCaixas } from './caixa';
import { cancelarVenda, registrarDevolucao } from './devolucoes';
import { OPERATOR } from './constants';
import { brl } from './utils';
import { garantirCodigos } from './etiquetas';

export function buildSeed(){
  const r = prng(20261105);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  let nextId = 1; const ids = () => nextId++;
  const today = startOfToday(); const todayIso = isoDate(today); const now = new Date();
  const NOMES = ['Ana','Beatriz','Camila','Daniela','Eduarda','Fernanda','Gabriela','Juliana','Larissa','Mariana','Patrícia','Rafaela','Bruno','Carlos','Diego','Felipe','Gustavo','Henrique','João','Lucas','Marcos','Pedro','Rafael','Thiago','Vinícius'];
  const SOBRENOMES = ['Silva','Souza','Oliveira','Santos','Pereira','Lima','Carvalho','Ferreira','Rodrigues','Almeida','Costa','Gomes','Martins','Rocha','Ribeiro','Barbosa','Moreira','Nascimento'];
  const clientes = NOMES.map((nome, i) => {
    const mes = i < 4 ? today.getMonth() : Math.floor(r() * 12);   // garante aniversariantes no mês atual
    const dia = i === 0 ? today.getDate() : 1 + Math.floor(r() * 28);
    const criado = i >= 22 ? -Math.floor(r() * Math.max(1, today.getDate() - 1)) : -(75 + Math.floor(r() * 300));
    return { id: 'C' + pad(i + 1), nome, sobrenome: pick(SOBRENOMES), telefone: '279' + (r() < 0.5 ? '8' : '9') + String(Math.floor(r() * 1e7)).padStart(7, '0'),
      nascimento: `${1968 + Math.floor(r() * 38)}-${pad(mes + 1)}-${pad(dia)}`, criadoEm: isoDate(addDays(today, criado)) };
  });

  const products = CATALOG.map((c, i) => {
    const id = 'PS' + pad(i + 1);
    return { id, nome: c[0], categoria: c[1], preco: c[2], custo: c[3],
      variantes: c[4].flatMap(t => c[5].map(cor => {
        let q = Math.floor(r() * 14) + 2; if (r() < 0.14) q = Math.floor(r() * 3);
        return { sku: `${id}-${t === 'Único' ? 'U' : t}-${slug(cor)}`, tam: t, cor, qtd: q, min: DEFAULT_MIN_STOCK };
      })) };
  });

  const fidDb = { vales: [], cashbacks: [], ciclos: {}, fid: { ...DEFAULT_FID } };
  const crediarios = [];
  const sales = []; const lanc = []; const movs = [];
  let saleNo = 1001;
  for (let d = SEED_DAYS; d >= 0; d--) {
    const day = addDays(today, -d); const wd = day.getDay();
    if (wd === 0) continue; // domingo fechado
    const isToday = d === 0;
    const elig = clientes.filter(c => c.criadoEm <= isoDate(day));
    const closeHour = isToday ? Math.min(now.getHours(), 19) : 19;
    if (closeHour < 9) continue;
    let count = Math.floor(4 + r() * 6) + (wd === 6 ? 3 : 0) + (day.getDate() >= 5 && day.getDate() <= 8 ? 2 : 0);
    if (isToday) count = Math.max(1, Math.round(count * (closeHour - 9) / 10));
    for (let k = 0; k < count; k++) {
      const when = new Date(day); when.setHours(9 + Math.floor(r() * (closeHour - 9 + 1)), Math.floor(r() * 60));
      const nItems = r() < 0.5 ? 1 : (r() < 0.7 ? 2 : 3);
      const itens = [];
      for (let j = 0; j < nItems; j++) {
        const p = pick(products); const v = pick(p.variantes);
        const ex = itens.find(x => x.sku === v.sku);
        if (ex) ex.qtd++; else itens.push({ sku: v.sku, pid: p.id, nome: p.nome, tam: v.tam, cor: v.cor, preco: p.preco, custo: p.custo, qtd: r() < 0.12 ? 2 : 1 });
      }
      const subtotal = round2(itens.reduce((s, i) => s + i.preco * i.qtd, 0));
      const desconto = r() < 0.18 ? round2(subtotal * 0.1) : 0;
      const clienteId = elig.length && r() < 0.6 ? pick(elig).id : null;
      let total = round2(subtotal - desconto); const valesIds = []; let valeUsado = 0, cashbackUsado = 0;
      if (clienteId) { const b = beneficiosDe(fidDb, clienteId, isoDate(day));
        if (b.vales.length && total > b.vales[0].valor && r() < 0.75) { valesIds.push(b.vales[0].id); valeUsado = b.vales[0].valor; total = round2(total - valeUsado); }
        if (b.cashSaldo > 0 && total > 1 && r() < 0.65) { cashbackUsado = round2(Math.min(b.cashSaldo, total - 1)); total = round2(total - cashbackUsado); } }
      const x = r(); let pagamento = x < 0.36 ? 'pix' : x < 0.72 ? 'credito' : x < 0.9 ? 'debito' : 'dinheiro';
      if (clienteId && total > 150 && r() < 0.15) pagamento = 'crediario';
      const parcelas = pagamento === 'credito' && total > 180 ? 1 + Math.floor(r() * 3) : pagamento === 'crediario' ? 2 + Math.floor(r() * 3) : 1;
      const sale = { id: saleNo++, data: isoDateTime(when), vendedor: OPERATOR, clienteId, itens, subtotal, desconto, valesIds, valeUsado, cashbackUsado, total, pagamento, parcelas };
      sales.push(sale);
      aplicarFidelidade(fidDb, sale, ids);
      lanc.push(...financeEntriesFor(sale, ids, todayIso));
      if (pagamento === 'crediario') {
        sale.entrada = r() < 0.4 ? round2(total * 0.2) : 0; sale.entradaForma = r() < 0.5 ? 'pix' : 'dinheiro';
        const cli = clientes.find(c => c.id === clienteId);
        const { cred, lancs } = criarCrediario(sale, sale.entrada, sale.entradaForma, addMonthsIso(isoDate(day), 1), ids, `${cli.nome} ${cli.sobrenome}`);
        cred.parcelas.forEach(p => { if (p.venc < todayIso && !(p.venc >= isoDate(addDays(today, -30)) && r() < 0.2)) { // parte das parcelas recentes fica em atraso p.pagoEm = p.venc; p.valorPago = p.valor; p.forma = r() < 0.6 ? 'pix' : 'dinheiro';
          const l = lancs.find(z => z.parcela === p.n); l.status = 'pago'; l.pagoEm = p.venc; } });
        crediarios.push(cred); lanc.push(...lancs);
      }
    }
  }
  sales.sort((a, b) => a.data.localeCompare(b.data));

  const curM = todayIso.slice(0,7);
  for (let m = shiftMonth(curM, -2); m <= curM; m = shiftMonth(m, 1)) {
    FIXED_EXPENSES.forEach(([descricao, categoria, valor, dia]) => {
      const venc = `${m}-${pad(Math.min(dia, daysInMonth(m)))}`;
      const pago = venc < todayIso;
      lanc.push({ id: ids(), data: venc, origem: 'Manual', tipo: 'despesa', categoria, descricao, valor, venc, status: pago ? 'pago' : 'pendente', pagoEm: pago ? venc : null });
    });
  }
  const supplier = (descricao, valor, offset, pago) => { const venc = isoDate(addDays(today, offset)); lanc.push({ id: ids(), data: venc, origem: 'Estoque', tipo: 'despesa', categoria: 'Fornecedores', descricao, valor, venc, status: pago ? 'pago' : 'pendente', pagoEm: pago ? venc : null }); };
  supplier('Reposição de camisetas Dry Fit (Confecção Vitória)', 6400, -40, true);
  supplier('Coleção de agasalhos (Malharia Serrana)', 9800, -18, true);
  supplier('Leggings e tops (Fit Têxtil), parcela 1/2', 4300, 4, false);
  supplier('Leggings e tops (Fit Têxtil), parcela 2/2', 4300, 34, false);
  lanc.push({ id: ids(), data: isoDate(addDays(today,-2)), origem: 'Manual', tipo: 'despesa', categoria: 'Logística', descricao: 'Frete da última reposição', valor: 280, venc: isoDate(addDays(today,-2)), status: 'pendente', pagoEm: null });

  // movimentações recentes de estoque para a tela de histórico
  sales.slice(-14).forEach(s => s.itens.forEach(i => movs.push({ id: ids(), data: s.data, tipo: 'saida', sku: i.sku, nome: i.nome, var: `${i.tam}, ${i.cor}`, qtd: i.qtd, origem: `Venda #${s.id}` })));
  const p1 = products[0]; const v1 = p1.variantes[1];
  movs.push({ id: ids(), data: isoDateTime(addDays(today, -3)), tipo: 'entrada', sku: v1.sku, nome: p1.nome, var: `${v1.tam}, ${v1.cor}`, qtd: 12, origem: 'Confecção Vitória' });

  const metas = { [shiftMonth(curM,-2)]: 45000, [shiftMonth(curM,-1)]: 48000, [curM]: 52000 };
  const mesFechado = shiftMonth(curM, -2);
  const fechamentos = { [mesFechado]: { ...calcResultado({ sales, lanc }, mesFechado), fechadoEm: `${shiftMonth(curM, -1)}-03`, obs: 'Conferido com o contador.' } };
  const db = { v: 5, crediarios, credCfg: { ...DEFAULT_CRED }, products, sales, lanc, movs, metas, clientes, vales: fidDb.vales, cashbacks: fidDb.cashbacks, ciclos: fidDb.ciclos, fid: fidDb.fid, fechamentos, nextSale: saleNo, nextId };
  // Caixas dos últimos 14 dias, um cancelamento e uma devolução de exemplo, com a auditoria correspondente.
  const auditoria = seedCaixas(db, ids);
  const ctxDe = (s, h) => ({ ids, usuario: OPERATOR, agora: `${s.data.slice(0, 10)}T${h}`, hoje: s.data.slice(0, 10), caixaId: s.caixaId });
  const recentes = sales.filter(s => s.caixaId && s.data < isoDate(today) && s.pagamento === 'pix' && !s.clienteId);
  const cancelada = recentes[1];
  if (cancelada) { cancelarVenda(db, cancelada, { forma: 'pix', motivo: 'Cliente desistiu na hora' }, ctxDe(cancelada, '18:20'));
    auditoria.push({ id: ids(), quando: cancelada.canceladaEm, usuario: OPERATOR, acao: 'Venda cancelada', detalhe: `Venda #${cancelada.id}, estorno de ${brl(cancelada.estorno.valor)} no Pix. Motivo: Cliente desistiu na hora` }); }
  const devolvida = sales.filter(s => s.caixaId && s.data < isoDate(today) && s.pagamento === 'dinheiro' && s.itens.length > 1)[0];
  if (devolvida) { const it = devolvida.itens[0]; const d = registrarDevolucao(db, devolvida, { qtds: { [it.sku]: 1 }, destino: 'estorno', forma: 'dinheiro', motivo: 'Tamanho não serviu' }, ctxDe(devolvida, '17:45'));
    auditoria.push({ id: ids(), quando: d.data, usuario: OPERATOR, acao: 'Devolução', detalhe: `Venda #${devolvida.id}: 1x ${it.nome} ${it.tam}, ${brl(d.valor)} em dinheiro. Motivo: Tamanho não serviu` }); }
  db.auditoria = auditoria.sort((a, b) => a.quando.localeCompare(b.quando));
  db.nextCodigo = 1; garantirCodigos(db);
  db.nextId = nextId;
  return db;}

/* Loja sem nenhum dado (usada pela API simulada). */
export function buildVazio(){
  const curM = isoDate(startOfToday()).slice(0, 7);
  return { v: 5, products: [], sales: [], lanc: [], movs: [], clientes: [], caixas: [], vales: [], cashbacks: [], ciclos: {}, crediarios: [],
    fid: { ...DEFAULT_FID }, credCfg: { ...DEFAULT_CRED }, metas: { [curM]: 0 }, fechamentos: {}, nextSale: 1001, nextId: 1, nextCodigo: 1 };
}

