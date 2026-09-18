import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { resetProviderHistory } from "@/adapters";
import { QueryKeys } from "@/lib/query-keys";
import { invalidatePerformanceCaches } from "@/lib/performance-cache";
import { useToast } from "@wealthfolio/ui/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@wealthfolio/ui/components/ui/alert-dialog";

interface ResetProviderHistoryDialogProps {
  assetId: string;
  assetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetProviderHistoryDialog({
  assetId,
  assetName,
  open,
  onOpenChange,
}: ResetProviderHistoryDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const reset = useMutation({
    mutationFn: () => resetProviderHistory(assetId),
    retry: false,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.QUOTE_HISTORY] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.LATEST_QUOTES] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.ASSET_DATA, result.assetId] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.HEALTH_STATUS] });
      invalidatePerformanceCaches(queryClient);
      toast({
        title: t("asset:resetDialog.success"),
        description: t(
          result.recalculationPending ? "asset:resetDialog.pending" : "asset:resetDialog.complete",
        ),
      });
      onOpenChange(false);
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  const errorMessage =
    reset.error instanceof Error ? reset.error.message : String(reset.error ?? "");
  // A lost response can occur after commit; never imply that a network error rolled back prices.
  const uncertain = /timeout|timed out|abort|network|fetch|connection|could not be confirmed/i.test(
    errorMessage,
  );

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (submitting.current) return;
        reset.reset();
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("asset:resetDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("asset:resetDialog.description", { name: assetName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {reset.isError && (
          <div role="alert" className="text-destructive space-y-2 text-sm">
            <p>{errorMessage}</p>
            {uncertain && <p>{t("asset:resetDialog.uncertain")}</p>}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={reset.isPending}>{t("common:cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={reset.isPending || (reset.isError && uncertain)}
            onClick={(event) => {
              event.preventDefault();
              if (submitting.current) return;
              submitting.current = true;
              reset.mutate();
            }}
          >
            {t(reset.isPending ? "asset:resetDialog.resetting" : "asset:resetDialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
