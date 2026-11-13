// Cada tipo de erro vira um codigo HTTP diferente no ErroHttpFilter.

/** 400 - dado enviado esta invalido (campo vazio, numero negativo...) */
export class ErroValidacao extends Error {}

/** 401 - nao foi informado quem esta fazendo a acao (cabecalho x-usuario-id) */
export class ErroNaoAutenticado extends Error {}

/** 403 - o papel do usuario nao tem permissao para a acao (RBAC) */
export class ErroPermissao extends Error {}

/** 404 - registro nao existe */
export class ErroNaoEncontrado extends Error {}

/** 409 - a acao nao e permitida no status atual (ou outro usuario mudou o status antes) */
export class ErroConflito extends Error {}

/** 422 - uma regra de negocio (guarda de transicao) bloqueou a acao */
export class ErroRegraNegocio extends Error {}
