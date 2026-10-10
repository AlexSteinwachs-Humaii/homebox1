<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Button } from "@/components/ui/button";
  import Checkbox from "@/components/Form/Checkbox.vue";
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
  import { DialogID, useDialog } from "@/components/ui/dialog-provider/utils";
  import { toast } from "@/components/ui/sonner";
  import type { EntitySummary } from "@/lib/api/types/data-contracts";
  import {
    defaultReportingColumns,
    reportingColumns,
    reportingExportUnavailable,
    selectedReportingColumns,
    type ReportingColumnId,
  } from "@/lib/reporting/csv";

  import { captureReportingView, reportingViewIsCurrent, downloadReportingCsv } from "@/lib/reporting/export";

  const props = defineProps<{
    items: EntitySummary[];
    loading: boolean;
    collectionId: string | null | undefined;
  }>();
  const { t } = useI18n();
  const { openDialog, closeDialog } = useDialog();
  const selected = ref<ReportingColumnId[]>([]);
  const preferences = useViewPreferences();
  const unavailable = computed(() => reportingExportUnavailable(props.loading, props.items.length));
  const snapshot = ref<string>();
  const currentView = () => ({
    items: props.items,
    loading: props.loading,
    collectionId: props.collectionId,
    activeCollectionId: preferences.value.collectionId ?? null,
  });
  const canDownload = computed(
    () => reportingViewIsCurrent(snapshot.value, currentView()) && selectedReportingColumns(selected.value).length > 0
  );
  const hintId = useId();
  const selectionHintId = useId();

  function open() {
    snapshot.value = captureReportingView(currentView());
    if (!snapshot.value) return;
    const headers = preferences.value.tableHeaders;
    selected.value = headers
      ? selectedReportingColumns(headers.filter(header => header.enabled).map(header => header.value)).map(
          column => column.id
        )
      : [...defaultReportingColumns];
    openDialog(DialogID.ReportingCsvExport);
  }

  function toggle(id: ReportingColumnId, enabled: boolean) {
    selected.value = enabled ? [...selected.value, id] : selected.value.filter(value => value !== id);
  }

  // A refresh must not leave an export interaction referring to an old result set.
  watch(
    currentView,
    () => {
      snapshot.value = undefined;
      closeDialog(DialogID.ReportingCsvExport);
    },
    { deep: true, flush: "sync" }
  );

  function download() {
    // Recheck synchronously: never rely on a queued watcher to protect collection boundaries.
    if (!canDownload.value) return;
    try {
      downloadReportingCsv(props.items, selected.value, t);
      closeDialog(DialogID.ReportingCsvExport);
    } catch {
      // Keep the selector and selection open so Download is the retry path.
      toast.error(t("home.csv.failed"));
    }
  }
</script>

<template>
  <div class="flex flex-col items-end gap-1">
    <Button :disabled="!!unavailable" :aria-describedby="unavailable ? hintId : undefined" @click="open">
      {{ $t("home.csv.export") }}
    </Button>
    <p v-if="unavailable" :id="hintId" class="text-sm text-muted-foreground" role="status">
      {{ $t(unavailable) }}
    </p>
  </div>
  <Dialog :dialog-id="DialogID.ReportingCsvExport">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ $t("home.csv.title") }}</DialogTitle>
        <DialogDescription>{{ $t("home.csv.description") }}</DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-3">
        <Checkbox
          v-for="column in reportingColumns"
          :key="column.id"
          :label="$t(column.label)"
          :model-value="selected.includes(column.id)"
          @update:model-value="toggle(column.id, $event)"
        />
      </div>
      <p v-if="!selected.length" :id="selectionHintId" class="text-sm text-muted-foreground" role="status">
        {{ $t("home.csv.select_one") }}
      </p>
      <DialogFooter>
        <Button variant="outline" @click="closeDialog(DialogID.ReportingCsvExport)">{{ $t("global.cancel") }}</Button>
        <Button
          :disabled="!canDownload"
          :aria-describedby="!selected.length ? selectionHintId : undefined"
          @click="download"
        >
          {{ $t("home.csv.download") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
