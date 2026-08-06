import { twenty538b1808Adapter } from './twenty538b1808Adapter';
import { type TwentyBrandingAdapter } from '../types/branding.types';

// The distribution embeds exactly one Twenty version, therefore exactly one
// current adapter — selected at build time (D5, doc 05 §5).
export const currentAdapter: TwentyBrandingAdapter = twenty538b1808Adapter;
