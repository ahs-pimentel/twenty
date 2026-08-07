import { Field, ObjectType } from '@nestjs/graphql';

import GraphQLJSON from 'graphql-type-json';

// Ephemeral preview artifact (doc 14 §3) — mirrors the runtime artifact
// served by GET /branding/current, but is generated on demand from the
// draft and never persisted or cached.
@ObjectType('O2dBrandingDraftPreview')
export class O2dBrandingDraftPreviewDTO {
  @Field(() => String)
  status: 'valid' | 'failed';

  @Field(() => GraphQLJSON)
  issues: object[];

  @Field(() => GraphQLJSON, { nullable: true })
  artifact: {
    hash: string;
    cssLight: Record<string, string>;
    cssDark: Record<string, string>;
    brand: { productName: string; shortName: string };
    assets: Record<string, { url: string; hash: string; format: string }>;
  } | null;
}
