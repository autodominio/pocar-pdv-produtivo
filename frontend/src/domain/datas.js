/* Datas no formato brasileiro (DD/MM/AAAA) <-> ISO (AAAA-MM-DD), usado pelo campo de data. */

/** Mantém só dígitos e insere as barras: "1503199" -> "15/03/199". */
export const mascaraData = texto => {
  const d = String(texto || '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

/** "2026-03-15" -> "15/03/2026"; vazio ou inválido -> "". */
export const isoParaBr = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

/** "15/03/2026" -> "2026-03-15"; data incompleta ou que não existe (31/02) -> null. */
export const brParaIso = br => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br || '');
  if (!m) return null;
  const [dia, mes, ano] = [+m[1], +m[2], +m[3]];
  if (ano < 1900 || mes < 1 || mes > 12 || dia < 1) return null;
  if (dia > new Date(Date.UTC(ano, mes, 0)).getUTCDate()) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};
