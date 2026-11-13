import { Papel, Status } from '../entity/requisicao';
import { ContextoTransicao } from './contexto';
import {
  AprovadorAindaNaoAprovou,
  CancelamentoPeloDonoOuGestor,
  ExigeAlcadaConfigurada,
  ExigeCotacoesCompletas,
  Guarda,
  LimiteDeCotacoes,
  SomenteSolicitante,
  TetoDoSolicitante,
} from './guardas';

export type Acao =
  | 'editar'
  | 'registrarCotacao'
  | 'removerCotacao'
  | 'enviarParaAprovacao'
  | 'aprovar'
  | 'rejeitar'
  | 'solicitarAjuste'
  | 'emitirOrdemCompra'
  | 'cancelar';

export type Transicao = {
  acao: Acao;
  de: Status[]; // em quais status a acao pode acontecer
  para: Status | ((contexto: ContextoTransicao) => Status); // status resultante
  papeis: Papel[]; // RBAC: quais papeis podem executar
  guardas: Guarda[]; // condicoes obrigatorias
  exigeJustificativa: boolean;
};

/** Para acoes que nao mudam o status (editar dados, mexer em cotacoes). */
const MANTEM_STATUS = (ctx: ContextoTransicao): Status => ctx.requisicao.status;

/** Aprovacao parcial: so vai para APROVADA quando atingir o numero da alcada. */
const APOS_APROVACAO = (ctx: ContextoTransicao): Status => {
  const aprovacoesComEsta = ctx.requisicao.aprovacoes.length + 1;
  const necessarias = ctx.alcada?.aprovacoesNecessarias ?? 1;

  return aprovacoesComEsta >= necessarias ? 'APROVADA' : 'AGUARDANDO_APROVACAO';
};

/**
 * MATRIZ DE TRANSICOES (estado x acao x papel x guardas).
 * E a unica fonte da verdade do fluxo: o status NUNCA e alterado direto,
 * so por uma destas acoes.
 */
export const TRANSICOES: Transicao[] = [
  {
    acao: 'editar',
    de: ['ABERTA', 'EM_AJUSTE'],
    para: MANTEM_STATUS,
    papeis: ['SOLICITANTE', 'GESTOR', 'DIRETOR'],
    guardas: [new SomenteSolicitante()],
    exigeJustificativa: false,
  },
  {
    acao: 'registrarCotacao',
    de: ['ABERTA', 'EM_AJUSTE'],
    para: MANTEM_STATUS,
    papeis: ['COMPRADOR'],
    guardas: [new LimiteDeCotacoes()],
    exigeJustificativa: false,
  },
  {
    acao: 'removerCotacao',
    de: ['ABERTA', 'EM_AJUSTE'],
    para: MANTEM_STATUS,
    papeis: ['COMPRADOR'],
    guardas: [],
    exigeJustificativa: false,
  },
  {
    acao: 'enviarParaAprovacao',
    de: ['ABERTA', 'EM_AJUSTE'],
    para: 'AGUARDANDO_APROVACAO',
    papeis: ['COMPRADOR'],
    guardas: [new ExigeCotacoesCompletas(), new ExigeAlcadaConfigurada()],
    exigeJustificativa: false,
  },
  {
    acao: 'aprovar',
    de: ['AGUARDANDO_APROVACAO'],
    para: APOS_APROVACAO,
    papeis: ['GESTOR', 'DIRETOR'],
    guardas: [new ExigeAlcadaConfigurada(), new TetoDoSolicitante(), new AprovadorAindaNaoAprovou()],
    exigeJustificativa: false,
  },
  {
    acao: 'rejeitar',
    de: ['AGUARDANDO_APROVACAO'],
    para: 'REJEITADA',
    papeis: ['GESTOR', 'DIRETOR'],
    guardas: [],
    exigeJustificativa: true,
  },
  {
    acao: 'solicitarAjuste',
    de: ['AGUARDANDO_APROVACAO'],
    para: 'EM_AJUSTE',
    papeis: ['GESTOR', 'DIRETOR'],
    guardas: [],
    exigeJustificativa: true,
  },
  {
    acao: 'emitirOrdemCompra',
    de: ['APROVADA'],
    para: 'ORDENADA',
    papeis: ['COMPRADOR'],
    guardas: [],
    exigeJustificativa: false,
  },
  {
    acao: 'cancelar',
    de: ['ABERTA', 'EM_AJUSTE', 'AGUARDANDO_APROVACAO', 'APROVADA'],
    para: 'CANCELADA',
    papeis: ['SOLICITANTE', 'GESTOR', 'DIRETOR'],
    guardas: [new CancelamentoPeloDonoOuGestor()],
    exigeJustificativa: true,
  },
];
