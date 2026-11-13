import { Module } from '@nestjs/common';
import { ProcurementModule } from '../module/procurement/procurement.module';

const modules = [ProcurementModule];

@Module({
  imports: [...modules],
  controllers: [],
  providers: [],
})
export class AppModule {}
