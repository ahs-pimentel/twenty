import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { getO2dFaviconUrl } from '@/o2d-branding/utils/getO2dFaviconUrl';
import {
  o2dBrandingArtifactState,
  o2dBrandingStatusState,
  type O2dBrandingStatus,
} from '@/o2d-branding/states/o2dBrandingArtifactState';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type UseO2dBrandingResult = {
  productName: string;
  shortName: string;
  hash: string;
  status: O2dBrandingStatus;
  assets: { favicon?: string };
};

// Public hook for the few integrated components (logo, title, favicon —
// doc 08 §6). Reflects the live artifact: embedded distribution branding
// until the published workspace configuration is fetched and applied.
export const useO2dBranding = (): UseO2dBrandingResult => {
  const o2dBrandingArtifact = useAtomStateValue(o2dBrandingArtifactState);
  const o2dBrandingStatus = useAtomStateValue(o2dBrandingStatusState);

  return {
    productName: o2dBrandingArtifact.brand.productName,
    shortName: o2dBrandingArtifact.brand.shortName,
    hash: o2dBrandingArtifact.hash,
    status: o2dBrandingStatus,
    assets: {
      favicon: getO2dFaviconUrl(REACT_APP_SERVER_BASE_URL, o2dBrandingArtifact),
    },
  };
};
