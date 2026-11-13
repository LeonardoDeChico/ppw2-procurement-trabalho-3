import { Dinheiro } from '../../../../shared/domain/value.objects/dinheiro.vo';
import { Prioridade, ValorPrioridade } from '../../../../shared/domain/value.objects/prioridade.vo';
import { Quantidade } from '../../../../shared/domain/value.objects/quantidade.vo';
import { Texto } from '../../../../shared/domain/value.objects/texto.vo';
import { ErroValidacao } from '../../../../shared/domain/erros';

/** Quantas cotacoes de fornecedores diferentes sao exigidas. */
export const LIMITE_COTACOES = 3;

export type Status =
  | 'ABERTA'
  | 'AGUARDANDO_APROVACAO'
  | 'EM_AJUSTE'
  | 'APROVADA'
  | 'REJEITADA'
  | 'ORDENADA'
  | 'CANCELADA';

export type Papel = 'SOLICITANTE' | 'COMPRADOR' | 'GESTOR' | 'DIRETOR';

export type Usuario = {
  id: number;
  nome: string;
  papel: Papel;
};

export type Alcada = {
  id: number;
  valorMinimo: number;
  aprovacoesNecessarias: number;
  solicitantePodeAprovar: boolean;
};

export type Cotacao = {
  id: number;
  fornecedor: string;
  valorUnitario: number;
  prazoDias: number;
  observacao: string | null;
  registradaEm: string;
};

export type Aprovacao = {
  id: number;
  aprovador: Usuario;
  justificativa: string | null;
  aprovadaEm: string;
};

export type OrdemCompra = {
  id: number;
  numero: string;
  cotacaoId: number;
  valorTotal: number;
  emitidaEm: string;
};

export type Requisicao = {
  id: number;
  titulo: string;
  item: string;
  quantidade: number;
  centroCusto: string;
  prioridade: ValorPrioridade;
  justificativa: string | null;
  status: Status;
  solicitante: Usuario;
  cotacoes: Cotacao[];
  aprovacoes: Aprovacao[]; // somente as aprovacoes ATIVAS da rodada atual
  ordemCompra: OrdemCompra | null;
  criadaEm: string;
  atualizadaEm: string | null;
};

export type DadosRequisicao = {
  titulo: string;
  item: string;
  quantidade: number;
  centroCusto: string;
  prioridade: ValorPrioridade;
  justificativa: string | null;
};

export type DadosCotacao = {
  fornecedor: string;
  valorUnitario: number;
  prazoDias: number;
  observacao: string | null;
};

/** Cotacao de menor valor unitario (a que sera usada na ordem de compra). */
export function melhorCotacao(requisicao: Requisicao): Cotacao | null {
  if (requisicao.cotacoes.length === 0) return null;

  return requisicao.cotacoes.reduce((melhor, atual) =>
    atual.valorUnitario < melhor.valorUnitario ? atual : melhor,
  );
}

/** Valor total da compra = melhor cotacao x quantidade. E ele que define a alcada. */
export function valorTotal(requisicao: Requisicao): number {
  const cotacao = melhorCotacao(requisicao);
  if (!cotacao) return 0;

  return Math.round(cotacao.valorUnitario * requisicao.quantidade * 100) / 100;
}

/** Valida no BACKEND os dados enviados pelo formulario (nao confia no front). */
export function validarDadosRequisicao(dados: any): DadosRequisicao {
  return {
    titulo: Texto.obrigatorio(dados?.titulo, 'título'),
    item: Texto.obrigatorio(dados?.item, 'item'),
    quantidade: Quantidade.criar(dados?.quantidade).valor,
    centroCusto: Texto.obrigatorio(dados?.centroCusto, 'centro de custo'),
    prioridade: Prioridade.criar(dados?.prioridade).valor,
    justificativa: Texto.opcional(dados?.justificativa),
  };
}

export function validarCotacao(dados: any): DadosCotacao {
  const prazo = Number(dados?.prazoDias);

  if (!Number.isInteger(prazo) || prazo < 1) {
    throw new ErroValidacao('O prazo de entrega deve ser um número inteiro de dias maior que zero.');
  }

  return {
    fornecedor: Texto.obrigatorio(dados?.fornecedor, 'fornecedor'),
    valorUnitario: Dinheiro.criar(dados?.valorUnitario).valor,
    prazoDias: prazo,
    observacao: Texto.opcional(dados?.observacao),
  };
}
