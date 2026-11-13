import { ErroValidacao } from '../erros';

export class Quantidade {
  private constructor(public readonly valor: number) {}

  static criar(valor: number): Quantidade {
    const numero = Number(valor);

    if (!Number.isInteger(numero) || numero < 1) {
      throw new ErroValidacao('A quantidade deve ser um número inteiro maior que zero.');
    }

    return new Quantidade(numero);
  }
}
