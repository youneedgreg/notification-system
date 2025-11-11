import { DataSourceOptions } from 'typeorm';
const config: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT || 5432),
  username: process.env.DATABASE_USER || 'notif_user',
  password: process.env.DATABASE_PASS || 'notif_pass_2024',
  database: process.env.DATABASE_NAME || 'notification_db',
  synchronize: true, // dev only
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
};
export default config;
