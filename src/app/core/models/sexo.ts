export enum Sexo {
  Masculino = 1,
  Femenino = 2,
  Otro = 3,
}

export const SexoLabel: Record<Sexo, string> = {
  [Sexo.Masculino]: 'Masculino',
  [Sexo.Femenino]: 'Femenino',
  [Sexo.Otro]: 'Otro',
};
