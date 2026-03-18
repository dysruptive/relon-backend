import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isFutureDate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!value) return true; // Let IsOptional handle null/undefined
          const date = new Date(value);
          const today = new Date();

          // Normalize both to UTC midnight of the same calendar day
          // For input date, we use its UTC components because usually dates are sent as UTC midnight (YYYY-MM-DD)
          const dateUtc = new Date(
            Date.UTC(
              date.getUTCFullYear(),
              date.getUTCMonth(),
              date.getUTCDate()
            )
          );

          // For today, we use local components to represent "Today" in server's timezone
          const todayUtc = new Date(
            Date.UTC(
              today.getFullYear(),
              today.getMonth(),
              today.getDate()
            )
          );

          return dateUtc >= todayUtc;
        },
        defaultMessage(args: ValidationArguments) {
          return 'Date must not be in the past';
        },
      },
    });
  };
}
