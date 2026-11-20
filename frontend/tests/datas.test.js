import { describe, expect, it } from 'vitest';
import { brParaIso, isoParaBr, mascaraData } from '../src/domain/datas';

describe('datas em DD/MM/AAAA', () => {
  it('aplica a máscara enquanto digita', () => {
    expect(mascaraData('15')).toBe('15');
    expect(mascaraData('1503')).toBe('15/03');
    expect(mascaraData('15031990')).toBe('15/03/1990');
    expect(mascaraData('15/03/1990xx9')).toBe('15/03/1990');
  });
  it('converte entre os formatos', () => {
    expect(isoParaBr('1990-03-15')).toBe('15/03/1990');
    expect(isoParaBr('')).toBe('');
    expect(brParaIso('15/03/1990')).toBe('1990-03-15');
  });
  it('recusa data incompleta ou que não existe', () => {
    expect(brParaIso('15/03/19')).toBeNull();
    expect(brParaIso('31/02/2024')).toBeNull();
    expect(brParaIso('29/02/2024')).toBe('2024-02-29');
    expect(brParaIso('29/02/2023')).toBeNull();
    expect(brParaIso('10/13/2024')).toBeNull();
  });
});
