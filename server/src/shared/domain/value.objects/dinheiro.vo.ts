import { ErroValidacao } from '../erros';

export class Dinheiro {
  private constructor(public readonly valor: number) {}

  static criar(valor: number): Dinheiro {
    const numero = Number(valor);

    if (!Number.isFinite(numero) || numero <= 0) {
      throw new ErroValidacao('O valor deve ser um número maior que zero.');
    }

    return new Dinheiro(Math.round(numero * 100) / 100);
  }
}
