import { IsArray, ValidateNested, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class StageOrder {
  @IsString()
  id: string;

  @IsInt()
  sortOrder: number;
}

export class ReorderStagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageOrder)
  stages: StageOrder[];
}
