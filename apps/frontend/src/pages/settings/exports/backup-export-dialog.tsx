import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { exportDatabaseBackup } from "@/adapters";
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
import { RadioGroup, RadioGroupItem } from "@wealthfolio/ui/components/ui/radio-group";
import { toast } from "@wealthfolio/ui/components/ui/use-toast";
import { generateBackupPassphrase, isValidBackupPassword } from "./backup-password";

interface BackupExportDialogProps {
  filename: string;
  onClose: () => void;
}

/** Mount once for the selected snapshot; closing drops all password form state. */
export function BackupExportDialog({ filename, onClose }: BackupExportDialogProps) {
  const { t } = useTranslation();
  const id = useId();
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  const [unencrypted, setUnencrypted] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clear = () => {
    setPassword("");
    setConfirmation("");
  };
  const close = () => {
    operation.current?.abort();
    clear();
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!unencrypted && !isValidBackupPassword(password)) {
      setError(t("settings:backup_export_password_invalid"));
      return;
    }
    if (!unencrypted && password !== confirmation) {
      setError(t("settings:backup_export_password_mismatch"));
      return;
    }
    setPending(true);
    const controller = new AbortController();
    operation.current = controller;
    try {
      const saved = await exportDatabaseBackup(
        filename,
        unencrypted ? null : password,
        unencrypted,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (saved) toast({ title: t("settings:backup_export_ready"), variant: "success" });
      close();
    } catch (error) {
      if (controller.signal.aborted) return;
      setError(error instanceof Error ? error.message : t("settings:backup_export_failed"));
    } finally {
      clear();
      setPending(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings:backup_export_dialog_title")}</DialogTitle>
          <DialogDescription className="break-all">
            {t("settings:backup_export_selected", { filename })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <RadioGroup
            disabled={pending}
            value={unencrypted ? "plain" : "protected"}
            onValueChange={(value) => {
              setUnencrypted(value === "plain");
              clear();
              setError(null);
            }}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="protected" id={`${id}-protected`} />
              <Label htmlFor={`${id}-protected`}>{t("settings:backup_export_protected")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="plain" id={`${id}-plain`} />
              <Label htmlFor={`${id}-plain`}>{t("settings:backup_export_plain")}</Label>
            </div>
          </RadioGroup>
          {unencrypted ? (
            <p className="text-sm" role="note">
              {t("settings:backup_export_plain_warning")}
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor={`${id}-password`}>{t("settings:backup_export_password")}</Label>
                <Input
                  id={`${id}-password`}
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  spellCheck={false}
                  autoCapitalize="none"
                  disabled={pending}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-describedby={`${id}-help`}
                />
                <Label htmlFor={`${id}-confirmation`}>
                  {t("settings:backup_export_confirm_password")}
                </Label>
                <Input
                  id={`${id}-confirmation`}
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  spellCheck={false}
                  autoCapitalize="none"
                  disabled={pending}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    const generated = generateBackupPassphrase();
                    setPassword(generated);
                    setConfirmation(generated);
                    setShow(true);
                  }}
                >
                  {t("settings:backup_export_generate")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setShow(!show)}
                >
                  {t(show ? "settings:backup_export_hide" : "settings:backup_export_show")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending || !password}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(password);
                      toast({ title: t("settings:backup_export_copied") });
                    } catch {
                      setError(t("settings:backup_export_copy_failed"));
                    }
                  }}
                >
                  {t("settings:backup_export_copy")}
                </Button>
              </div>
              <p id={`${id}-help`} className="text-muted-foreground text-sm">
                {t("settings:backup_export_password_help")}
              </p>
              <a
                className="text-muted-foreground text-xs underline"
                href="https://www.eff.org/dice"
                target="_blank"
                rel="noreferrer"
              >
                {t("settings:backup_export_wordlist")}
              </a>
            </>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {t("common:cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t(
                pending
                  ? "settings:backup_export_busy"
                  : unencrypted
                    ? "settings:backup_export_plain_button"
                    : "common:export",
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
