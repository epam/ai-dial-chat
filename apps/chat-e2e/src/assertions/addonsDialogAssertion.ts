import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { AddonsDialog } from '@/src/ui/webElements';

export class AddonsDialogAssertion extends BaseAssertion {
  readonly addonsDialog: AddonsDialog;

  constructor(addonsDialog: AddonsDialog) {
    super();
    this.addonsDialog = addonsDialog;
  }
}
