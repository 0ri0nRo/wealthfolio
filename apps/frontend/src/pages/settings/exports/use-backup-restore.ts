import { backupDatabase, deleteDatabaseBackup, listDatabaseBackups } from "@/adapters";
import { QueryKeys } from "@/lib/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@wealthfolio/ui/components/ui/use-toast";
import { useTranslation } from "react-i18next";

export function useBackupRestore() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const backups = useQuery({
    queryKey: [QueryKeys.DATABASE_BACKUPS],
    queryFn: listDatabaseBackups,
    // Sync and maintenance can create snapshots outside this screen.
    refetchOnMount: "always",
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: [QueryKeys.DATABASE_BACKUPS] });
  const reportError = (error: unknown) =>
    toast({
      title: t("settings:backup_action_failed"),
      description: String(error),
      variant: "destructive",
    });
  const create = useMutation({
    mutationFn: backupDatabase,
    onSuccess: () => {
      void refresh();
      toast({ title: t("settings:backup_saved"), variant: "success" });
    },
    onError: reportError,
  });
  const remove = useMutation({
    mutationFn: deleteDatabaseBackup,
    onSuccess: () => {
      void refresh();
    },
    onError: reportError,
  });
  return { backups, create, remove };
}
