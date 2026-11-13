import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ErroHttpFilter } from './shared/presentation/erro-http.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new ErroHttpFilter());

  app.enableCors({
    origin: 'http://localhost:3000',
    methods: 'GET, POST, PUT, DELETE',
    allowedHeaders: 'Content-Type, Accept, X-Usuario-Id',
    credentials: false,
  });

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
