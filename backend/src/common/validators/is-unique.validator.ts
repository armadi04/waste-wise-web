import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';

@ValidatorConstraint({ name: 'isUnique', async: true })
@Injectable()
export class IsUniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly dataSource: DataSource) {}

  async validate(value: unknown, args: ValidationArguments) {
    const [EntityClass, column] = args.constraints as [
      EntityTarget<ObjectLiteral>,
      string,
    ];
    if (!value) return true;

    const repository = this.dataSource.getRepository(EntityClass);
    const count = await repository.countBy({
      [column]: value,
    });
    return count === 0;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} already exists`;
  }
}

export function IsUnique(
  EntityClass: EntityTarget<ObjectLiteral>,
  column: string = 'name',
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [EntityClass, column],
      validator: IsUniqueConstraint,
    });
  };
}
