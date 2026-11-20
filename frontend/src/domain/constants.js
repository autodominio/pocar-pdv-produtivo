/* Constantes de negócio da loja. */
export const STORAGE_KEY = 'pocar-sport-proto-v5';
export const CARD_FEES = { pix: 0, dinheiro: 0, debito: 0.0139, credito: 0.0349, crediario: 0 };
export const PAY_LABEL = { pix: 'Pix', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro', crediario: 'Crediário' };
export const CREDIT_SETTLEMENT_DAYS = 30;
export const DEFAULT_MIN_STOCK = 3;
export const SEED_DAYS = 70;
export const CAT_DESP = ['Fornecedores','Pessoal','Ocupação','Marketing','Serviços','Impostos','Logística','Outras despesas'];
export const CAT_REC = ['Vendas externas','Outras receitas'];
export const OPERATOR = 'Leonardo';
export const COLORS = { 'preto':'#111','branco':'#fff','amarelo':'#FBD625','cinza':'#8d8d8d','grafite':'#3b3d40','azul-marinho':'#1d2a4a','mescla':'#b4b4b0','off-white':'#f1ece0','preto/amarelo':'linear-gradient(90deg,#111 50%,#FBD625 50%)','verde':'#2e7d4f','vermelho':'#c0262d','azul':'#2457c5','rosa':'#e88aa8','preta':'#111','branca':'#fff','laranja':'#f08a24','única':'#d6d6d0' };

export const CATALOG = [
  ['Camiseta Dry Fit Pocar','Camisetas',89.9,32,['P','M','G','GG'],['Preto','Branco','Amarelo']],
  ['Regata Performance','Camisetas',69.9,24,['P','M','G','GG'],['Preto','Cinza']],
  ['Legging Compressão','Leggings',129.9,48,['P','M','G'],['Preto','Grafite']],
  ['Top Fitness Alta Sustentação','Tops',79.9,27,['P','M','G'],['Preto','Amarelo']],
  ['Shorts Running 2 em 1','Shorts',99.9,36,['P','M','G','GG'],['Preto','Azul-marinho']],
  ['Bermuda Moletom','Shorts',119.9,44,['M','G','GG'],['Preto','Mescla']],
  ['Jaqueta Corta-vento','Agasalhos',249.9,98,['P','M','G','GG'],['Preto','Amarelo']],
  ['Moletom Canguru Pocar','Agasalhos',199.9,78,['P','M','G','GG'],['Preto','Off-white']],
  ['Calça Jogger Tech','Calças',169.9,62,['P','M','G','GG'],['Preto','Grafite']],
  ['Boné Aba Curva','Acessórios',79.9,25,['Único'],['Preto','Preto/Amarelo']],
  ['Meia Cano Médio (3 pares)','Acessórios',49.9,15,['Único'],['Branco','Preto']],
];
export const FIXED_EXPENSES = [
  ['Salários e comissões','Pessoal',7800,5],['Anúncios no Instagram','Marketing',900,3],['Aluguel da loja','Ocupação',4500,10],
  ['Contador','Serviços',650,10],['Sistema e maquininha','Serviços',119,12],['Energia elétrica','Ocupação',640,15],
  ['Internet e telefone','Ocupação',189.9,20],['Simples Nacional (DAS)','Impostos',2100,20],
];

export const FIN_TABS = [{ id: 'fluxo', label: 'Fluxo de caixa' }, { id: 'contas', label: 'Contas a pagar e receber' }, { id: 'lucro', label: 'Lucro por período' }, { id: 'dre', label: 'Resultado (DRE)' }, { id: 'fixas', label: 'Despesas fixas' }];

/* Quem usa o sistema. Troque os nomes aqui; na versão com backend vira o cadastro de usuários com senha. */
export const USUARIOS = ['Leonardo', 'Administrador'];

/* Caixa, devoluções e trocas */
export const VALOR_INICIAL_CAIXA = 200;
export const CAT_ESTORNO = 'Estornos a clientes';
export const FORMAS_ESTORNO = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Estorno no cartão' };
export const MOTIVOS_DEVOLUCAO = ['Tamanho não serviu', 'Defeito na peça', 'Cliente desistiu', 'Cor ou modelo diferente do esperado', 'Outro'];
export const VALE_TROCA_VALIDADE_DIAS = 90;
