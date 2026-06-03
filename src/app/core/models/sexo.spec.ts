import { Sexo, SexoLabel } from './sexo';

describe('Sexo', () => {
  it('has Masculino = 1', () => {
    expect(Sexo.Masculino).toBe(1);
  });

  it('has Femenino = 2', () => {
    expect(Sexo.Femenino).toBe(2);
  });

  it('has Otro = 3', () => {
    expect(Sexo.Otro).toBe(3);
  });
});

describe('SexoLabel', () => {
  it('maps Masculino to "Masculino"', () => {
    expect(SexoLabel[Sexo.Masculino]).toBe('Masculino');
  });

  it('maps Femenino to "Femenino"', () => {
    expect(SexoLabel[Sexo.Femenino]).toBe('Femenino');
  });

  it('maps Otro to "Otro"', () => {
    expect(SexoLabel[Sexo.Otro]).toBe('Otro');
  });

  it('covers all enum values', () => {
    const values = Object.values(Sexo).filter((v) => typeof v === 'number');
    for (const v of values) {
      expect(SexoLabel[v as Sexo]).toBeDefined();
    }
  });
});
