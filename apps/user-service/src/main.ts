import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 4000);

  console.log('DB host:', process.env.DATABASE_HOST);
console.log('DB user:', process.env.DATABASE_USER);


  console.log(`Server is running on http://localhost:${process.env.PORT ?? 4000}`);
}
bootstrap();
