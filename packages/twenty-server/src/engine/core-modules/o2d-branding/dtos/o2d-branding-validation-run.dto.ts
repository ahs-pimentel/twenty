import { Field, ObjectType } from '@nestjs/graphql';

import GraphQLJSON from 'graphql-type-json';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

// GraphQL shape of the async validation run (doc 19 §validate) — the
// mutation answers immediately with the run descriptor; the result field
// fills in once the worker completes.
@ObjectType('O2dBrandingValidationRun')
export class O2dBrandingValidationRunDTO {
  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => String)
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';

  @Field()
  draftHash: string;

  @Field(() => GraphQLJSON, { nullable: true })
  result: { status: 'valid' | 'failed'; issues: unknown[] } | null;

  @Field()
  startedAt: string;

  @Field(() => String, { nullable: true })
  finishedAt: string | null;
}
