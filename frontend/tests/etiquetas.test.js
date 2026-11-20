import { describe, it, expect } from 'vitest';
import { digitoEan13, ean13Valido, codigoInterno, barrasEan13, garantirCodigos, FOLHAS, posicaoEtiqueta, montarEtiquetas, totalFolhas } from '@/domain/etiquetas';

describe('EAN-13', () => {
  it('calcula o dígito verificador de códigos conhecidos', () => {
    expect(digitoEan13('400638133393')).toBe('1');   // 4006381333931
    expect(digitoEan13('590123412345')).toBe('7');   // 5901234123457
    expect(ean13Valido('7891000315507')).toBe(true);
    expect(ean13Valido('7891000315508')).toBe(false);
  });

  it('gera códigos internos com prefixo 2 e verificador válido', () => {
    expect(codigoInterno(1)).toBe('2000000000015');
    expect(ean13Valido(codigoInterno(987654))).toBe(true);
  });

  it('monta as 95 barras com as guardas do padrão', () => {
    const b = barrasEan13('5901234123457');
    expect(b).toHaveLength(95);
    expect(b.slice(0, 3)).toBe('101'); expect(b.slice(45, 50)).toBe('01010'); expect(b.slice(92)).toBe('101');
    expect(b.slice(3, 10)).toBe('0001011');           // 9 em código L (o 1º dígito 5 define LGGLLG)
  });
});

describe('códigos das variações', () => {
  it('dá código só para quem não tem, sem repetir', () => {
    const db = { nextCodigo: 1, products: [{ variantes: [{ sku: 'A', codigoBarras: '2000000000015' }, { sku: 'B' }, { sku: 'C' }] }] };
    expect(garantirCodigos(db)).toBe(2);
    const codigos = db.products[0].variantes.map(v => v.codigoBarras);
    expect(new Set(codigos).size).toBe(3);
    expect(codigos.every(ean13Valido)).toBe(true);
    expect(garantirCodigos(db)).toBe(0);
  });
});

describe('folhas de etiquetas', () => {
  const a4351 = FOLHAS[0];

  it('posiciona em colunas e linhas e passa para a folha seguinte', () => {
    expect(posicaoEtiqueta(a4351, 0)).toEqual({ pagina: 0, x: 4.7, y: 10.7 });
    expect(posicaoEtiqueta(a4351, 6)).toMatchObject({ pagina: 0, x: 4.7 + 40.6, y: 10.7 + 21.2 });
    expect(posicaoEtiqueta(a4351, 65).pagina).toBe(1);
  });

  it('começa numa posição já avançada para aproveitar folha usada', () => {
    expect(posicaoEtiqueta(a4351, 0, { inicio: 11 })).toMatchObject({ pagina: 0, y: 10.7 + 2 * 21.2 });
    expect(totalFolhas(a4351, 60, 11)).toBe(2);
  });

  it('gera uma etiqueta por unidade pedida', () => {
    const p = [{ nome: 'Camiseta', preco: 45.9, variantes: [{ sku: 'X', tam: 'M', cor: 'Preto', codigoBarras: '2000000000015' }, { sku: 'Y', tam: 'G', cor: 'Preto' }] }];
    const e = montarEtiquetas(p, { X: 3, Y: 0 });
    expect(e).toHaveLength(3);
    expect(e[0]).toMatchObject({ nome: 'Camiseta', variacao: 'M, Preto', preco: 45.9 });
  });
});
