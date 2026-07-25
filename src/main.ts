import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // CORS_ORIGIN: lista separada por vírgula de origens permitidas em produção
  // (ex.: "https://tucumamilgrau.com.br,https://www.tucumamilgrau.com.br").
  // Sem a variável definida (dev local), libera qualquer origem.
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // process.cwd() (não __dirname) para funcionar igual em dev (ts-node, roda de src/) e
  // produção (dist/src/), sempre resolvendo para <raiz do projeto>/uploads.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3001);
  console.log(
    `Portal Tucumã Milgrau API rodando em http://localhost:${process.env.PORT ?? 3001}/api`,
  );
}
bootstrap();
