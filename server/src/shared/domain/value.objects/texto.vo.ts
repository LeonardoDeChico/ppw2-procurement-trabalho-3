import { ErroValidacao } from '../erros';

export class Texto {
  /** Campo obrigatorio: tira espacos e nao aceita vazio. */
  static obrigatorio(valor: unknown, campo: string): string {
    const texto = String(valor ?? '').trim();

    if (!texto) {
      throw new ErroValidacao(`O campo ${campo} é obrigatório.`);
    }

    return texto;
  }

  /** Campo opcional: string vazia vira null. */
  static opcional(valor: unknown): string | null {
    const texto = String(valor ?? '').trim();
    return texto ? texto : null;
  }
}
