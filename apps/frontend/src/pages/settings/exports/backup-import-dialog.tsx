import { reloadApplication } from "@/lib/reload-application";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  discardDatabaseBackupImport,
  getDatabaseEncryptionStatus,
  inspectDatabaseBackup,
  inspectSavedDatabaseBackup,
  openDatabaseFileDialog,
  restoreDatabaseBackupImport,
  type BackupImportPreview,
} from "@/adapters";
import { QueryKeys } from "@/lib/query-keys";
import { Button } from "@wealthfolio/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wealthfolio/ui/components/ui/dialog";
import { Input } from "@wealthfolio/ui/components/ui/input";
import { Label } from "@wealthfolio/ui/components/ui/label";

export function BackupImportDialog({
  filename,
  onClose,
}: {
  filename?: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const encryption = useQuery({
    queryKey: [QueryKeys.DATABASE_ENCRYPTION],
    queryFn: getDatabaseEncryptionStatus,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [preview, setPreview] = useState<BackupImportPreview | null>(null);
  const [pending, setPending] = useState<"inspect" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef<AbortController | null>(null);
  const previewId = useRef<string | null>(null);
  useEffect(
    () => () => {
      operation.current?.abort();
      if (previewId.current)
        void discardDatabaseBackupImport(previewId.current).catch(() => undefined);
    },
    [],
  );
  const close = () => {
    if (pending === "restore") return;
    operation.current?.abort();
    setPassword("");
    onClose();
  };
  const inspect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending || (!filename && !selected)) return;
    const controller = new AbortController();
    operation.current = controller;
    setPending("inspect");
    setError(null);
    try {
      const result = filename
        ? await inspectSavedDatabaseBackup(filename, controller.signal)
        : await inspectDatabaseBackup(selected!, password || null, controller.signal);
      if (!controller.signal.aborted && result) {
        previewId.current = result.id;
        setPreview(result);
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(String(error));
    } finally {
      setPassword("");
      setPending(null);
    }
  };
  const confirm = async () => {
    if (pending || !preview || previewId.current !== preview.id || !encryption.data) return;
    setPending("restore");
    setError(null);
    previewId.current = null;
    try {
      await restoreDatabaseBackupImport(preview.id);
      reloadApplication();
    } catch (error) {
      setError(String(error));
      setPreview(null);
      setPending(null);
    }
  };
  const choose = async () => {
    try {
      const path = await openDatabaseFileDialog();
      if (path) {
        setSelected(path);
        setPassword("");
        setError(null);
      }
    } catch (error) {
      setError(String(error));
    }
  };
  const created = preview?.summary.createdAt ? new Date(preview.summary.createdAt) : null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (pending === "restore") event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending === "restore") event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("settings:backup_restore_title")}</DialogTitle>
          <DialogDescription>{t("settings:backup_import_description")}</DialogDescription>
        </DialogHeader>
        {preview ? (
          <div className="space-y-4">
            <h3 className="font-medium">{t("settings:recovery_preview")}</h3>
            <p>
              {t("settings:recovery_counts", {
                accounts: preview.summary.accountCount,
                activities: preview.summary.activityCount,
              })}
            </p>
            {created && !Number.isNaN(created.getTime()) && (
              <p>
                {t("settings:recovery_created", {
                  date: created.toLocaleString(i18n.resolvedLanguage),
                })}
              </p>
            )}
            <p>{t("settings:backup_import_confirmation")}</p>
            {encryption.data && (
              <p>
                {t(
                  encryption.data.enabled
                    ? "settings:backup_destination_encrypted"
                    : "settings:backup_destination_plain",
                )}
              </p>
            )}
            <p className="text-muted-foreground text-sm">{t("settings:backup_import_reconnect")}</p>
            <DialogFooter>
              <Button variant="outline" disabled={pending === "restore"} onClick={close}>
                {t("common:cancel")}
              </Button>
              <Button
                disabled={pending !== null || !encryption.data}
                onClick={() => void confirm()}
              >
                {t(
                  pending === "restore"
                    ? "settings:recovery_restoring"
                    : "settings:backup_confirm_restore",
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={inspect}>
            {filename ? (
              <p className="break-all text-sm">{filename}</p>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending !== null}
                  onClick={() => void choose()}
                >
                  {t(selected ? "settings:recovery_change_file" : "settings:recovery_choose_file")}
                </Button>
                {typeof selected === "string" && (
                  <p className="break-all text-sm">{selected.split(/[\\/]/).pop()}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor={`${id}-password`}>{t("settings:recovery_password")}</Label>
                  <Input
                    id={`${id}-password`}
                    type={showPassword ? "text" : "password"}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={password}
                    disabled={pending !== null}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending !== null}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {t(
                      showPassword ? "settings:backup_export_hide" : "settings:backup_export_show",
                    )}
                  </Button>
                  <p className="text-muted-foreground text-sm">
                    {t("settings:recovery_password_help")}
                  </p>
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                {t("common:cancel")}
              </Button>
              <Button type="submit" disabled={pending !== null || (!filename && !selected)}>
                {t(
                  pending === "inspect"
                    ? "settings:recovery_inspecting"
                    : "settings:recovery_inspect",
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
        {encryption.isError && <p role="alert">{t("settings:backup_encryption_status_failed")}</p>}
        {error && (
          <p role="alert" className="text-destructive break-words text-sm">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
