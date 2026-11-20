import { describe, expect, it } from 'vitest';
import { categoriaDe, limparNome, produtosDaPlanilha, separarTamanhoDoNome } from '../src/domain/importacao';

const linha = (productName, variantName, quantity, costPrice = 10, price = 20) => ({ productName, variantName, quantity, costPrice, price });

describe('importação da planilha do PDV antigo', () => {
  it('limpa espaços e capitaliza', () => {
    expect(limparNome(' joelheira  Neoprene ')).toBe('Joelheira Neoprene');
  });

  it('tira o tamanho do nome das regatas NBA', () => {
    expect(separarTamanhoDoNome('Regata NBA phila 23 M')).toEqual({ nome: 'Regata NBA phila 23', tam: 'M' });
    expect(separarTamanhoDoNome('Regata NBA Warriors 30M')).toEqual({ nome: 'Regata NBA Warriors 30', tam: 'M' });
    expect(separarTamanhoDoNome('Regatas NBA Brooklyn 33 M')).toEqual({ nome: 'Regata NBA Brooklyn 33', tam: 'M' });
    expect(separarTamanhoDoNome('Regata NBA M usa 6')).toEqual({ nome: 'Regata NBA usa 6', tam: 'M' });
    expect(separarTamanhoDoNome('Regata NBA New York 11')).toEqual({ nome: 'Regata NBA New York 11', tam: null });
    expect(separarTamanhoDoNome('Camisa Flamengo M')).toEqual({ nome: 'Camisa Flamengo M', tam: null });
  });

  it('classifica as categorias', () => {
    expect(categoriaDe('Camisa Flamengo Titular 26/27')).toBe('Camisas de time');
    expect(categoriaDe('Camisa Dryfit básica preta')).toBe('Camisetas Dry Fit');
    expect(categoriaDe('Meias Anti derrapante')).toBe('Meias');
    expect(categoriaDe('Caneleira Adulto')).toBe('Proteção e suporte');
    expect(categoriaDe('Bomba de Ar Brasport')).toBe('Acessórios');
  });

  it('agrupa variações: tamanho, cor ou único', () => {
    const [camisa, meia, bomba] = produtosDaPlanilha([
      linha('Camisa X ', 'GG', 2, 50), linha('Camisa X', 'M', 1, 56),
      linha('Meias Y', 'Preta', 3), linha('Meias Y', 'Branca', 1),
      linha('Bomba', null, 4),
    ]);
    expect(camisa.variantes.map(v => [v.tam, v.cor, v.qtd])).toEqual([['M', 'Única', 1], ['GG', 'Única', 2]]);
    expect(camisa.custo).toBe(52); // média ponderada: (2*50 + 1*56) / 3
    expect(meia.variantes.map(v => [v.tam, v.cor])).toEqual([['Único', 'Branca'], ['Único', 'Preta']]);
    expect(bomba.variantes).toEqual([{ sku: 'PL003-U-UNICA', tam: 'Único', cor: 'Única', qtd: 4, min: 0 }]);
  });

  it('soma linhas repetidas da mesma variação', () => {
    const [p] = produtosDaPlanilha([linha('Fone', null, 1), linha('Fone', null, 2)]);
    expect(p.variantes).toHaveLength(1);
    expect(p.variantes[0].qtd).toBe(3);
  });
});
