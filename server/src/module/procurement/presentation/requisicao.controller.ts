import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ErroNaoAutenticado } from '../../../shared/domain/erros';
import { FluxoAprovacaoService } from '../application/fluxo-aprovacao.service';
import { RequisicaoService } from '../application/requisicao.service';

type CorpoJustificativa = { justificativa?: string };

/**
 * Quem esta usando o sistema vem no cabecalho "x-usuario-id"
 * (login simulado: o front tem um seletor de usuario no topo).
 */
function usuarioObrigatorio(cabecalho: string | undefined): number {
  const id = Number(cabecalho);

  if (!cabecalho || !Number.isInteger(id) || id < 1) {
    throw new ErroNaoAutenticado('Informe o usuário no cabeçalho x-usuario-id.');
  }

  return id;
}

@Controller('procurement')
export class RequisicaoController {
  constructor(
    private readonly requisicoes: RequisicaoService,
    private readonly fluxo: FluxoAprovacaoService,
  ) {}

  // ---------------- consultas

  @Get('usuarios')
  usuarios() {
    return this.requisicoes.listarUsuarios();
  }

  @Get('alcadas')
  alcadas() {
    return this.requisicoes.listarAlcadas();
  }

  @Get('requisicoes')
  listar() {
    return this.requisicoes.listar();
  }

  @Get('requisicoes/:id')
  detalhar(@Param('id', ParseIntPipe) id: number, @Headers('x-usuario-id') usuario?: string) {
    return this.requisicoes.detalhar(id, usuario ? Number(usuario) : null);
  }

  // ---------------- cadastro (nao muda status)

  @Post('requisicoes')
  criar(@Body() corpo: unknown, @Headers('x-usuario-id') usuario?: string) {
    return this.requisicoes.criar(corpo, usuarioObrigatorio(usuario));
  }

  @Put('requisicoes/:id')
  editar(@Param('id', ParseIntPipe) id: number, @Body() corpo: unknown, @Headers('x-usuario-id') usuario?: string) {
    return this.requisicoes.editar(id, corpo, usuarioObrigatorio(usuario));
  }

  @Post('requisicoes/:id/cotacoes')
  registrarCotacao(
    @Param('id', ParseIntPipe) id: number,
    @Body() corpo: unknown,
    @Headers('x-usuario-id') usuario?: string,
  ) {
    return this.requisicoes.registrarCotacao(id, corpo, usuarioObrigatorio(usuario));
  }

  @Delete('requisicoes/:id/cotacoes/:cotacaoId')
  removerCotacao(
    @Param('id', ParseIntPipe) id: number,
    @Param('cotacaoId', ParseIntPipe) cotacaoId: number,
    @Headers('x-usuario-id') usuario?: string,
  ) {
    return this.requisicoes.removerCotacao(id, cotacaoId, usuarioObrigatorio(usuario));
  }

  // ---------------- transicoes de status (unico jeito de mudar o status)

  @Post('requisicoes/:id/enviar')
  enviar(@Param('id', ParseIntPipe) id: number, @Headers('x-usuario-id') usuario?: string) {
    return this.fluxo.enviarParaAprovacao(id, usuarioObrigatorio(usuario));
  }

  @Post('requisicoes/:id/aprovar')
  aprovar(
    @Param('id', ParseIntPipe) id: number,
    @Body() corpo: CorpoJustificativa,
    @Headers('x-usuario-id') usuario?: string,
  ) {
    return this.fluxo.aprovar(id, usuarioObrigatorio(usuario), corpo?.justificativa);
  }

  @Post('requisicoes/:id/rejeitar')
  rejeitar(
    @Param('id', ParseIntPipe) id: number,
    @Body() corpo: CorpoJustificativa,
    @Headers('x-usuario-id') usuario?: string,
  ) {
    return this.fluxo.rejeitar(id, usuarioObrigatorio(usuario), corpo?.justificativa);
  }

  @Post('requisicoes/:id/solicitar-ajuste')
  solicitarAjuste(
    @Param('id', ParseIntPipe) id: number,
    @Body() corpo: CorpoJustificativa,
    @Headers('x-usuario-id') usuario?: string,
  ) {
    return this.fluxo.solicitarAjuste(id, usuarioObrigatorio(usuario), corpo?.justificativa);
  }

  @Post('requisicoes/:id/cancelar')
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() corpo: CorpoJustificativa,
    @Headers('x-usuario-id') usuario?: string,
  ) {
    return this.fluxo.cancelar(id, usuarioObrigatorio(usuario), corpo?.justificativa);
  }

  @Post('requisicoes/:id/ordem-compra')
  emitirOrdem(@Param('id', ParseIntPipe) id: number, @Headers('x-usuario-id') usuario?: string) {
    return this.fluxo.emitirOrdemCompra(id, usuarioObrigatorio(usuario));
  }
}
