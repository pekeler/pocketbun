// Ported from pocketbase/tests/app.go (simplified for Bun).

import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MailerEvent } from "../core/events.ts";
import { BaseApp } from "../core/base.ts";
import { TestMailer } from "./mailer.ts";

export class TestApp extends BaseApp {
  eventCalls: Record<string, number> = {};
  testMailer: TestMailer = new TestMailer();

  resetEventCalls(): void {
    this.eventCalls = {};
  }

  registerEventCall(name: string): void {
    this.eventCalls[name] = (this.eventCalls[name] ?? 0) + 1;
  }

  bindEventCounters(): void {
    const bindTagged = <T extends { Next: () => unknown }>(
      name: string,
      hook: { Bind: (handler: { Func: (e: T) => unknown; Priority?: number }) => string },
    ) => {
      hook.Bind({
        Func: (e) => {
          this.registerEventCall(name);
          return e.Next();
        },
        Priority: -100,
      });
    };

    bindTagged("OnCollectionsListRequest", this.OnCollectionsListRequest());
    bindTagged("OnCollectionViewRequest", this.OnCollectionViewRequest());
    bindTagged("OnCollectionCreateRequest", this.OnCollectionCreateRequest());
    bindTagged("OnCollectionUpdateRequest", this.OnCollectionUpdateRequest());
    bindTagged("OnCollectionDeleteRequest", this.OnCollectionDeleteRequest());
    bindTagged("OnCollectionsImportRequest", this.OnCollectionsImportRequest());
    bindTagged("OnCollectionValidate", this.OnCollectionValidate());
    bindTagged("OnCollectionCreate", this.OnCollectionCreate());
    bindTagged("OnCollectionCreateExecute", this.OnCollectionCreateExecute());
    bindTagged("OnCollectionAfterCreateSuccess", this.OnCollectionAfterCreateSuccess());
    bindTagged("OnCollectionAfterCreateError", this.OnCollectionAfterCreateError());
    bindTagged("OnCollectionUpdate", this.OnCollectionUpdate());
    bindTagged("OnCollectionUpdateExecute", this.OnCollectionUpdateExecute());
    bindTagged("OnCollectionAfterUpdateSuccess", this.OnCollectionAfterUpdateSuccess());
    bindTagged("OnCollectionAfterUpdateError", this.OnCollectionAfterUpdateError());
    bindTagged("OnCollectionDelete", this.OnCollectionDelete());
    bindTagged("OnCollectionDeleteExecute", this.OnCollectionDeleteExecute());
    bindTagged("OnCollectionAfterDeleteSuccess", this.OnCollectionAfterDeleteSuccess());
    bindTagged("OnCollectionAfterDeleteError", this.OnCollectionAfterDeleteError());
    bindTagged("OnBatchRequest", this.OnBatchRequest());
    bindTagged("OnRealtimeConnectRequest", this.OnRealtimeConnectRequest());
    bindTagged("OnRealtimeMessageSend", this.OnRealtimeMessageSend());
    bindTagged("OnRealtimeSubscribeRequest", this.OnRealtimeSubscribeRequest());
    bindTagged("OnSettingsListRequest", this.OnSettingsListRequest());
    bindTagged("OnSettingsUpdateRequest", this.OnSettingsUpdateRequest());
    bindTagged("OnSettingsReload", this.OnSettingsReload());
    bindTagged("OnBackupCreate", this.OnBackupCreate());
    bindTagged("OnBackupRestore", this.OnBackupRestore());

    bindTagged("OnModelCreate", this.OnModelCreate());
    bindTagged("OnModelCreateExecute", this.OnModelCreateExecute());
    bindTagged("OnModelAfterCreateSuccess", this.OnModelAfterCreateSuccess());
    bindTagged("OnModelAfterCreateError", this.OnModelAfterCreateError());
    bindTagged("OnModelUpdate", this.OnModelUpdate());
    bindTagged("OnModelUpdateExecute", this.OnModelUpdateExecute());
    bindTagged("OnModelAfterUpdateSuccess", this.OnModelAfterUpdateSuccess());
    bindTagged("OnModelAfterUpdateError", this.OnModelAfterUpdateError());
    bindTagged("OnModelValidate", this.OnModelValidate());
    bindTagged("OnModelDelete", this.OnModelDelete());
    bindTagged("OnModelDeleteExecute", this.OnModelDeleteExecute());
    bindTagged("OnModelAfterDeleteSuccess", this.OnModelAfterDeleteSuccess());
    bindTagged("OnModelAfterDeleteError", this.OnModelAfterDeleteError());

    bindTagged("OnRecordValidate", this.OnRecordValidate());
    bindTagged("OnRecordCreate", this.OnRecordCreate());
    bindTagged("OnRecordCreateExecute", this.OnRecordCreateExecute());
    bindTagged("OnRecordAfterCreateSuccess", this.OnRecordAfterCreateSuccess());
    bindTagged("OnRecordAfterCreateError", this.OnRecordAfterCreateError());
    bindTagged("OnRecordUpdate", this.OnRecordUpdate());
    bindTagged("OnRecordUpdateExecute", this.OnRecordUpdateExecute());
    bindTagged("OnRecordAfterUpdateSuccess", this.OnRecordAfterUpdateSuccess());
    bindTagged("OnRecordAfterUpdateError", this.OnRecordAfterUpdateError());
    bindTagged("OnRecordDelete", this.OnRecordDelete());
    bindTagged("OnRecordDeleteExecute", this.OnRecordDeleteExecute());
    bindTagged("OnRecordAfterDeleteSuccess", this.OnRecordAfterDeleteSuccess());
    bindTagged("OnRecordAfterDeleteError", this.OnRecordAfterDeleteError());

    bindTagged("OnRecordEnrich", this.OnRecordEnrich());
    bindTagged("OnRecordAuthWithPasswordRequest", this.OnRecordAuthWithPasswordRequest());
    bindTagged("OnRecordAuthWithOAuth2Request", this.OnRecordAuthWithOAuth2Request());
    bindTagged("OnRecordAuthWithOTPRequest", this.OnRecordAuthWithOTPRequest());
    bindTagged("OnRecordsListRequest", this.OnRecordsListRequest());
    bindTagged("OnRecordViewRequest", this.OnRecordViewRequest());
    bindTagged("OnRecordCreateRequest", this.OnRecordCreateRequest());
    bindTagged("OnRecordUpdateRequest", this.OnRecordUpdateRequest());
    bindTagged("OnRecordDeleteRequest", this.OnRecordDeleteRequest());
    bindTagged("OnRecordAuthRequest", this.OnRecordAuthRequest());
    bindTagged("OnRecordAuthRefreshRequest", this.OnRecordAuthRefreshRequest());
    bindTagged("OnRecordCreateOTPRequest", this.OnRecordCreateOTPRequest());
    bindTagged("OnRecordRequestPasswordResetRequest", this.OnRecordRequestPasswordResetRequest());
    bindTagged("OnRecordConfirmPasswordResetRequest", this.OnRecordConfirmPasswordResetRequest());
    bindTagged("OnRecordRequestVerificationRequest", this.OnRecordRequestVerificationRequest());
    bindTagged("OnRecordConfirmVerificationRequest", this.OnRecordConfirmVerificationRequest());
    bindTagged("OnRecordRequestEmailChangeRequest", this.OnRecordRequestEmailChangeRequest());
    bindTagged("OnRecordConfirmEmailChangeRequest", this.OnRecordConfirmEmailChangeRequest());
    bindTagged("OnFileDownloadRequest", this.OnFileDownloadRequest());
    bindTagged("OnFileTokenRequest", this.OnFileTokenRequest());

    this.OnMailerSend().BindFunc((e: MailerEvent) => {
      this.registerEventCall("OnMailerSend");
      e.Mailer = this.testMailer;
      return e.Next();
    });

    bindTagged("OnMailerRecordAuthAlertSend", this.OnMailerRecordAuthAlertSend());
    bindTagged("OnMailerRecordPasswordResetSend", this.OnMailerRecordPasswordResetSend());
    bindTagged("OnMailerRecordVerificationSend", this.OnMailerRecordVerificationSend());
    bindTagged("OnMailerRecordEmailChangeSend", this.OnMailerRecordEmailChangeSend());
    bindTagged("OnMailerRecordOTPSend", this.OnMailerRecordOTPSend());
  }
}

export async function newTestApp(dataDir?: string): Promise<{ app: TestApp; cleanup: () => Promise<void> }> {
  const source = dataDir ?? resolve(fileURLToPath(new URL("./data", import.meta.url)));
  const tempDir = await mkdtemp(join(tmpdir(), "pocketbun-test-"));
  await cp(source, tempDir, { recursive: true });

  const app = new TestApp({ dataDir: tempDir, encryptionEnv: "pb_test_env" });
  app.bootstrap();
  app.runAllMigrations();
  app.settings().logs.maxDays = 0;
  app.bindEventCounters();

  return {
    app,
    cleanup: async () => {
      app.resetEventCalls();
      app.testMailer.reset();
      app.resetBootstrapState();
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}
