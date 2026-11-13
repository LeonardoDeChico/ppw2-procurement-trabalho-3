import { Module } from '@nestjs/common';
import { Banco } from '../../shared/infrastructure/database/banco';
import { FluxoAprovacaoService } from './application/fluxo-aprovacao.service';
import { RequisicaoService } from './application/requisicao.service';
import { MaquinaEstados } from './domain/maquina-estados/maquina-estados';
import { REQUISICAO_REPOSITORY } from './domain/ports/requisicao.repository';
import { RequisicaoSqliteRepository } from './infrastructure/requisicao.sqlite.repository';
import { RequisicaoController } from './presentation/requisicao.controller';

@Module({
  controllers: [RequisicaoController],
  providers: [
    Banco,
    { provide: REQUISICAO_REPOSITORY, useClass: RequisicaoSqliteRepository },
    { provide: MaquinaEstados, useValue: new MaquinaEstados() },
    RequisicaoService,
    FluxoAprovacaoService,
  ],
})
export class ProcurementModule {}
