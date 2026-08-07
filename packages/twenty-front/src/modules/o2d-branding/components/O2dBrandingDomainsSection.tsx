import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { styled } from '@linaria/react';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { H2Title } from 'twenty-ui/typography';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { type O2dBrandingAdminDomain } from '@/o2d-branding/types/O2dBrandingAdmin';

type O2dBrandingDomainsSectionProps = {
  domains: O2dBrandingAdminDomain[];
  isBusy: boolean;
  onUpsert: (hostname: string) => void;
  onRemove: (domain: O2dBrandingAdminDomain) => void;
};

const StyledAddRow = styled.div`
  align-items: flex-end;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledDomainRow = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]} 0;
`;

// Domain → branding mapping (doc 12): each host listed here serves this
// workspace's published branding on the public endpoint. DNS/routing stay
// with the existing custom-domain setup — this only picks the identity.
export const O2dBrandingDomainsSection = ({
  domains,
  isBusy,
  onUpsert,
  onRemove,
}: O2dBrandingDomainsSectionProps) => {
  const [newHostname, setNewHostname] = useState('');

  const handleAdd = () => {
    const hostname = newHostname.trim();

    if (hostname === '') {
      return;
    }

    onUpsert(hostname);
    setNewHostname('');
  };

  return (
    <Section>
      <H2Title
        title={t`Domains`}
        description={t`Hostnames that serve this workspace's branding before login. Point the DNS separately; this mapping only selects the visual identity.`}
      />
      <StyledAddRow>
        <SettingsTextInput
          instanceId="o2d-branding-new-domain"
          label={t`Hostname`}
          value={newHostname}
          onChange={setNewHostname}
          placeholder="crm.exemplo.com.br"
          fullWidth
        />
        <Button
          title={t`Add domain`}
          disabled={isBusy || newHostname.trim() === ''}
          onClick={handleAdd}
        />
      </StyledAddRow>
      {domains.map((domain) => (
        <StyledDomainRow key={domain.id}>
          <span>
            {domain.hostname} · {domain.status}
            {domain.configurationId !== null ? ` · ${t`pinned config`}` : ''}
          </span>
          <Button
            title={t`Remove`}
            size="small"
            disabled={isBusy}
            onClick={() => onRemove(domain)}
          />
        </StyledDomainRow>
      ))}
    </Section>
  );
};
