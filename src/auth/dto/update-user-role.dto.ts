import { IsIn } from 'class-validator';

const ROLES = ['READER', 'ADMIN'] as const;

export class UpdateUserRoleDto {
  @IsIn(ROLES)
  role: (typeof ROLES)[number];
}
