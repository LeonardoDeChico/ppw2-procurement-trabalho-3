import { ErroValidacao } from '../erros';

export type ValorPrioridade = 'BAIXA' | 'MEDIA' | 'ALTA';

const PRIORIDADES: ValorPrioridade[] = ['BAIXA', 'MEDIA', 'ALTA'];

export class Prioridade {
  private constructor(public readonly valor: ValorPrioridade) {}

  static criar(valor: string): Prioridade {
    const prioridade = String(valor ?? '').toUpperCase() as ValorPrioridade;

    if (!PRIORIDADES.includes(prioridade)) {
      throw new ErroValidacao('A prioridade deve ser BAIXA, MEDIA ou ALTA.');
    }

    return new Prioridade(prioridade);
  }
}
