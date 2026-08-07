import { Field, Int, ObjectType } from '@nestjs/graphql';

import GraphQLJSON from 'graphql-type-json';

// Automatic changelog diff between two immutable version snapshots
// (doc 15 §2). Change entries keep the util's shape: tokenChanges
// {tokenPath, mode, kind, from, to} and assetChanges {slot, kind,
// fromHash, toHash}.
@ObjectType('O2dBrandingVersionDiff')
export class O2dBrandingVersionDiffDTO {
  @Field(() => Int)
  fromNumber: number;

  @Field(() => Int)
  toNumber: number;

  @Field(() => GraphQLJSON)
  tokenChanges: object[];

  @Field(() => GraphQLJSON)
  assetChanges: object[];
}
