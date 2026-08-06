import { i18n } from '@lingui/core';
import { messages as enMessages } from '~/locales/generated/en';
import { getPageTitleFromPath } from '~/utils/title-utils';

// O2D-PATCH: P3
import { getO2dProductName } from '@/o2d-branding/utils/getO2dProductName';

i18n.load('en', enMessages);
i18n.activate('en');

describe('title-utils', () => {
  it('should return the correct title for a given path', () => {
    expect(getPageTitleFromPath('/verify')).toBe('Verify');
    expect(getPageTitleFromPath('/welcome')).toBe(
      'Sign in or Create an account',
    );
    expect(getPageTitleFromPath('/invite/:workspaceInviteHash')).toBe('Invite');
    expect(getPageTitleFromPath('/workspace-activation')).toBe(
      'Create Workspace',
    );
    expect(getPageTitleFromPath('/create/profile')).toBe('Create Profile');
    expect(getPageTitleFromPath('/settings/objects/opportunities')).toBe(
      'Data model - Settings',
    );
    expect(getPageTitleFromPath('/settings/profile')).toBe(
      'Profile - Settings',
    );
    expect(getPageTitleFromPath('/settings/experience')).toBe(
      'Experience - Settings',
    );
    expect(getPageTitleFromPath('/settings/accounts')).toBe(
      'Account - Settings',
    );
    expect(getPageTitleFromPath('/settings/accounts/new')).toBe(
      'Account - Settings',
    );
    expect(getPageTitleFromPath('/settings/accounts/calendars')).toBe(
      'Account - Settings',
    );
    expect(
      getPageTitleFromPath('/settings/accounts/calendars/:accountUuid'),
    ).toBe('Account - Settings');
    expect(getPageTitleFromPath('/settings/accounts/emails')).toBe(
      'Account - Settings',
    );
    expect(getPageTitleFromPath('/settings/accounts/emails/:accountUuid')).toBe(
      'Account - Settings',
    );
    expect(getPageTitleFromPath('/settings/members')).toBe(
      'Members - Settings',
    );
    expect(getPageTitleFromPath('/settings/general')).toBe(
      'General - Settings',
    );
    // O2D-PATCH: P3 — fallback is the distribution product name
    expect(getPageTitleFromPath('/')).toBe(getO2dProductName());
    expect(getPageTitleFromPath('/random')).toBe(getO2dProductName());
  });
});
