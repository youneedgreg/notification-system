import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({name: 'users'})
export class User {
    @PrimaryGeneratedColumn('uuid')
    user_id: string;

    @Column({unique: true})
    email: string;

    @Column()
    name: string;

    @Column()
    password_hash: string;

    @Column({default: true})
    email_verified: boolean;

    @CreateDateColumn()
    created_at: Date;
}