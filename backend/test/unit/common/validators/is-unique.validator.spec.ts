import { DataSource } from 'typeorm';
import type { ValidationArguments } from 'class-validator';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { IsUniqueConstraint } from '../../../../src/common/validators/is-unique.validator';

class FakeEntity {}

describe('IsUniqueConstraint', () => {
  let constraint: IsUniqueConstraint;
  let countBy: jest.Mock;

  const args = {
    constraints: [FakeEntity, 'email'],
    property: 'email',
  } as unknown as ValidationArguments;

  beforeEach(() => {
    countBy = jest.fn();
    const dataSource = {
      getRepository: jest.fn(() => ({ countBy })),
    } as unknown as DataSource;
    constraint = new IsUniqueConstraint(dataSource);
  });

  it('should pass immediately for an empty value without querying', async () => {
    await expect(constraint.validate('', args)).resolves.toBe(true);
    expect(countBy).not.toHaveBeenCalled();
  });

  it('should pass when no existing row matches', async () => {
    countBy.mockResolvedValue(0);

    await expect(constraint.validate('new@b.com', args)).resolves.toBe(true);
    expect(countBy).toHaveBeenCalledWith({ email: 'new@b.com' });
  });

  it('should fail when a matching row already exists', async () => {
    countBy.mockResolvedValue(1);

    await expect(constraint.validate('taken@b.com', args)).resolves.toBe(false);
  });

  it('should build a default message from the property name', () => {
    expect(constraint.defaultMessage(args)).toBe('email already exists');
  });
});
