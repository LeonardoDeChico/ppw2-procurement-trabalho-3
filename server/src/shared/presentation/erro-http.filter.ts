import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import {
  ErroConflito,
  ErroNaoAutenticado,
  ErroNaoEncontrado,
  ErroPermissao,
  ErroRegraNegocio,
  ErroValidacao,
} from '../domain/erros';

/**
 * Traduz os erros do dominio para o codigo HTTP correto.
 * O front-end so precisa ler "message" para mostrar ao usuario.
 */
@Catch()
export class ErroHttpFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const resposta = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      resposta.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const status = this.statusDoErro(exception);
    const mensagem = status === 500 ? 'Erro interno no servidor.' : this.mensagem(exception);

    if (status === 500) {
      console.error(exception);
    }

    resposta.status(status).json({ statusCode: status, message: mensagem });
  }

  private statusDoErro(erro: unknown): number {
    if (erro instanceof ErroValidacao) return 400;
    if (erro instanceof ErroNaoAutenticado) return 401;
    if (erro instanceof ErroPermissao) return 403;
    if (erro instanceof ErroNaoEncontrado) return 404;
    if (erro instanceof ErroConflito) return 409;
    if (erro instanceof ErroRegraNegocio) return 422;

    // Erros vindos das constraints do proprio banco (ultima linha de defesa)
    const mensagem = erro instanceof Error ? erro.message : '';
    if (mensagem.includes('UNIQUE constraint failed')) return 409;
    if (mensagem.includes('constraint failed') || mensagem.includes('imutavel')) return 400;

    return 500;
  }

  private mensagem(erro: unknown): string {
    const texto = erro instanceof Error ? erro.message : String(erro);

    if (texto.includes('UNIQUE constraint failed: cotacoes')) {
      return 'Este fornecedor já possui cotação nesta requisição.';
    }
    if (texto.includes('UNIQUE constraint failed: aprovacoes')) {
      return 'Este gestor já aprovou esta requisição.';
    }

    return texto;
  }
}
