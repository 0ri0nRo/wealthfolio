import { render, screen } from "@/test/render";
import { expect, it, vi } from "vitest";
import { TooltipProvider } from "@wealthfolio/ui/components/ui/tooltip";
import settings from "@/i18n/locales/en/settings.json";
import { BackupRestoreForm } from "./backup-restore-form";

const runtime = vi.hoisted(() => ({ mode: "web" }));
vi.mock("./use-backup-restore", () => ({
  useBackupRestore: () => ({
    platformMode: runtime.mode,
    performBackup: vi.fn(),
    performRestore: vi.fn(),
    deleteWebBackup: vi.fn(),
    getWebBackupDownloadUrl: (filename: string) => `/backups/${filename}`,
    isBackingUp: false,
    isRestoring: false,
    isDeletingWebBackup: false,
    isLoadingWebBackups: false,
    webBackupsError: null,
    canBackup: true,
    canRestore: true,
    webBackups: [{ filename: "old.db", sizeBytes: 4096, modifiedAt: "2026-09-01T12:00:00Z" }],
  }),
}));

it("explains creation-time encryption beside server downloads, including old backups", () => {
  runtime.mode = "web";
  render(
    <TooltipProvider>
      <BackupRestoreForm />
    </TooltipProvider>,
  );
  expect(screen.getByText(settings.database_encryption_server_backup_warning)).toBeVisible();
  expect(screen.getByRole("link", { name: /old.db/ })).toHaveAccessibleDescription(
    settings.database_encryption_server_backup_warning,
  );
  expect(screen.queryByText(settings.database_encryption_export_warning)).not.toBeInTheDocument();
});

it.each(["desktop", "mobile"])("warns before creating a portable export on %s", (mode) => {
  runtime.mode = mode;
  render(<BackupRestoreForm />);
  expect(screen.getByText(settings.database_encryption_export_warning)).toBeVisible();
  expect(
    screen.queryByText(settings.database_encryption_server_backup_warning),
  ).not.toBeInTheDocument();
});
