import { Alcada, Requisicao, Usuario } from '../entity/requisicao';

/** Tudo que a maquina de estados precisa saber para decidir uma transicao. */
export type ContextoTransicao = {
  requisicao: Requisicao;
  usuario: Usuario; // quem esta executando a acao
  alcada: Alcada | null; // faixa de aprovacao do valor atual da compra
  justificativa: string | null;
};
