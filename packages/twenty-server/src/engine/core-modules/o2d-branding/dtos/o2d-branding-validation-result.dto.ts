import { Field, ObjectType } from '@nestjs/graphql';

import GraphQLJSON from 'graphql-type-json';

@ObjectType('O2dBrandingValidationResult')
export class O2dBrandingValidationResultDTO {
  @Field()
  status: 'valid' | 'failed';

  // Issues keep the per-token shape from doc 19 §3 (rule, tokenPath, mode,
  // measured, required, message).
  @Field(() => GraphQLJSON)
  issues: object[];
}
