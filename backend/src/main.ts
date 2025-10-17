import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger'
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

    const prismaService = app.get(PrismaService);
  try {
    await prismaService.$connect();
    console.log('✅ Database connected successfully!');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }

  const config = new DocumentBuilder()
  .setTitle('CueGrowth API')
  .setDescription('Outreach Automation & Intelligence API')
  .setVersion('v1')
  .build();

  const doc = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('docs',app, doc)

  const port = `${process.env.PORT}`

  await app.listen(port ?? 3000);
   console.log(`API:    http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`Swagger http://localhost:${process.env.PORT ?? 3000}/docs`);
}
bootstrap();
