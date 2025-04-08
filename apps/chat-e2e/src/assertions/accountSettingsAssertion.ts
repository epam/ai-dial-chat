import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { AccountSettings } from '@/src/ui/webElements';

export class AccountSettingsAssertion extends BaseAssertion {
  readonly accountSettings: AccountSettings;

  constructor(accountSettings: AccountSettings) {
    super();
    this.accountSettings = accountSettings;
  }
}
