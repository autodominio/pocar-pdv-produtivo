/* Ícones SVG inline usados no menu e nos botões. */
const ICON = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const icons = {
  home: ICON('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  cart: ICON('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H6"/>'),
  box: ICON('<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'),
  money: ICON('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>'),
  receipt: ICON('<path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5-2 1.5-2.5-1.5L5 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
  users: ICON('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>'),
  gift: ICON('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>'),
  flag: ICON('<path d="M4 21V4"/><path d="M4 4h13l-2 4 2 4H4"/>'),
  download: ICON('<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>'),
  register: ICON('<rect x="3" y="11" width="18" height="10" rx="1.5"/><path d="M7 11V5h10v6"/><path d="M10 8h4"/><path d="M7 16h2M11 16h2M15 16h2"/>'),
  shield: ICON('<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  tag: ICON('<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  plus: ICON('<path d="M12 5v14M5 12h14"/>'),
  key: ICON('<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3"/><path d="M16 7l3 3"/><path d="M14 9l2 2"/>'),
};

export const VIEWS = [
  { id:'painel', label:'Painel', short:'Painel', title:'Painel', icon: icons.home },
  { id:'pdv', label:'PDV', short:'PDV', title:'Ponto de venda', icon: icons.cart },
  { id:'caixa', label:'Caixa', short:'Caixa', title:'Caixa e vendas', icon: icons.register },
  { id:'estoque', label:'Estoque', short:'Estoque', title:'Estoque', icon: icons.box },
  { id:'financeiro', label:'Financeiro', short:'Financeiro', title:'Financeiro', icon: icons.money },
  { id:'crediario', label:'Crediário', short:'Crediário', title:'Crediário', icon: icons.receipt },
  { id:'clientes', label:'Clientes', short:'Clientes', title:'Clientes', icon: icons.users },
  { id:'fidelidade', label:'Fidelidade', short:'Fidelidade', title:'Programa de fidelidade', icon: icons.gift },
  { id:'metas', label:'Metas', short:'Metas', title:'Metas', icon: icons.flag },
  { id:'auditoria', label:'Auditoria', short:'Auditoria', title:'Auditoria', icon: icons.shield },
  { id:'usuarios', label:'Usuários', short:'Usuários', title:'Usuários e acessos', icon: icons.key },
];
