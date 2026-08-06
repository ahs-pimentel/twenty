import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import {
  O2D_BRANDING_VALIDATION_JOB_NAME,
  type O2dBrandingValidationJobData,
} from 'src/engine/core-modules/o2d-branding/jobs/o2d-branding-validation.job-constants';
import { O2dBrandingValidationRunService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-validation-run.service';

@Processor(MessageQueue.workspaceQueue)
export class O2dBrandingValidationJob {
  constructor(
    private readonly validationRunService: O2dBrandingValidationRunService,
  ) {}

  @Process(O2D_BRANDING_VALIDATION_JOB_NAME)
  async handle(data: O2dBrandingValidationJobData): Promise<void> {
    await this.validationRunService.execute(data);
  }
}
