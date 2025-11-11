export class CreateUserDto {
    email: string;
    name: string
    password: string;
    request_id?: string;
}