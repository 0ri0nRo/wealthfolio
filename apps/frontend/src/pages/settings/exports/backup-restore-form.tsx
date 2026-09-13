import { getDatabaseBackupDownloadUrl, isWeb, openDatabaseBackupFolder } from "@/adapters";
import { usePlatform } from "@/hooks/use-platform";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@wealthfolio/ui";
import { DeleteConfirm } from "@wealthfolio/ui/components/common";
import { Button } from "@wealthfolio/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wealthfolio/ui/components/ui/card";
import { useBackupRestore } from "./use-backup-restore";
import { BackupExportDialog } from "./backup-export-dialog";
import { BackupImportDialog } from "./backup-import-dialog";

export function BackupRestoreForm() {
  const { t } = useTranslation();
  const formatting = useDateFormatting();
  const { platform } = usePlatform();
  const [folderError, setFolderError] = useState<string | null>(null);
  const { backups, create, remove } = useBackupRestore();
  const [exporting, setExporting] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<{ filename?: string } | null>(null);
  const busy = create.isPending || remove.isPending || exporting !== null || restoring !== null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings:backup_title")}</CardTitle>
        <CardDescription>{t("settings:backup_managed_description")}</CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button disabled={busy} onClick={() => create.mutate()}>
            {t(create.isPending ? "settings:backup_creating_short" : "settings:backup_now")}
          </Button>
          {!isWeb && (
            <Button variant="outline" disabled={busy} onClick={() => setRestoring({})}>
              {t("settings:backup_restore_from_file")}
            </Button>
          )}
          {!isWeb && platform?.is_desktop && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setFolderError(null);
                void openDatabaseBackupFolder().catch((error) => setFolderError(String(error)));
              }}
            >
              {t("settings:backup_open_folder")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {folderError && <p role="alert">{folderError}</p>}
        <p className="text-muted-foreground text-sm">{t("settings:backup_portable_help")}</p>
        {backups.isPending ? (
          <p role="status">{t("settings:backup_loading")}</p>
        ) : backups.isError ? (
          <div role="alert" className="space-y-2">
            <p>{t("settings:backup_load_error")}</p>
            <Button variant="outline" onClick={() => void backups.refetch()}>
              {t("common:retry")}
            </Button>
          </div>
        ) : backups.data.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center">
            {t("settings:backup_empty_title")}
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {backups.data.map((backup) => {
              const date = new Date(backup.modifiedAt);
              return (
                <li
                  key={backup.filename}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="break-all text-sm font-medium">{backup.filename}</p>
                    <p className="text-muted-foreground text-xs">
                      {Number.isNaN(date.getTime())
                        ? t("settings:backup_unknown_date")
                        : formatting.formatDateTime(date, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                      {" · "}
                      {formatBackupSize(backup.sizeBytes)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t(`settings:backup_protection_${backup.protection}`)}
                      {" · "}
                      {t(`settings:backup_reason_${backup.reason}`)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isWeb && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || backup.protection === "unavailable"}
                        onClick={() => setRestoring({ filename: backup.filename })}
                        aria-label={t("settings:backup_restore_item", {
                          filename: backup.filename,
                        })}
                      >
                        {t("settings:backup_restore_title")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || backup.protection === "unavailable"}
                      onClick={() => setExporting(backup.filename)}
                      aria-label={t("settings:backup_export_item", { filename: backup.filename })}
                    >
                      {t("common:export")}
                    </Button>
                    <DeleteConfirm
                      deleteConfirmTitle={t("settings:backup_delete_title")}
                      deleteConfirmMessage={t("settings:backup_delete_snapshot", {
                        filename: backup.filename,
                      })}
                      handleDeleteConfirm={() => remove.mutate(backup.filename)}
                      isPending={remove.isPending}
                      button={
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          aria-label={t("settings:backup_delete_item", {
                            filename: backup.filename,
                          })}
                        >
                          {t("common:delete")}
                        </Button>
                      }
                    />
                  </div>
                  {isWeb && (
                    <details className="w-full text-sm">
                      <summary className="cursor-pointer">
                        {t("settings:backup_original_advanced")}
                      </summary>
                      <p className="text-muted-foreground my-2">
                        {t("settings:backup_original_warning")}
                      </p>
                      <a
                        className="underline underline-offset-4"
                        href={getDatabaseBackupDownloadUrl(backup.filename)}
                        aria-disabled={busy}
                        onClick={(event) => {
                          if (busy) event.preventDefault();
                        }}
                      >
                        {t("settings:backup_original_save")}
                      </a>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      {exporting && (
        <BackupExportDialog
          key={exporting}
          filename={exporting}
          onClose={() => setExporting(null)}
        />
      )}
      {!isWeb && restoring && (
        <BackupImportDialog filename={restoring.filename} onClose={() => setRestoring(null)} />
      )}
    </Card>
  );
}

function formatBackupSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
