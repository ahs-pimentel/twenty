import { workspacePublicDataState } from '@/auth/states/workspacePublicDataState';
// O2D-PATCH: P4
import { o2dBrandingArtifactState } from '@/o2d-branding/states/o2dBrandingArtifactState';
import { getO2dFaviconUrl } from '@/o2d-branding/utils/getO2dFaviconUrl';
import { DEFAULT_WORKSPACE_LOGO } from '@/ui/navigation/navigation-drawer/constants/DefaultWorkspaceLogo';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { getImageAbsoluteURI } from 'twenty-shared/utils';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const PageFavicon = () => {
  const workspacePublicData = useAtomStateValue(workspacePublicDataState);
  // O2D-PATCH: P4 — a published branding favicon takes priority; the
  // workspace logo remains the fallback when no favicon asset is published.
  const o2dBrandingArtifact = useAtomStateValue(o2dBrandingArtifactState);
  const o2dFaviconUrl = getO2dFaviconUrl(
    REACT_APP_SERVER_BASE_URL,
    o2dBrandingArtifact,
  );
  return (
    <Helmet>
      <link
        rel="icon"
        type="image/x-icon"
        href={
          o2dFaviconUrl ??
          (workspacePublicData?.logo
            ? (getImageAbsoluteURI({
                imageUrl: workspacePublicData.logo,
                baseUrl: REACT_APP_SERVER_BASE_URL,
              }) ?? DEFAULT_WORKSPACE_LOGO)
            : DEFAULT_WORKSPACE_LOGO)
        }
      />
    </Helmet>
  );
};
