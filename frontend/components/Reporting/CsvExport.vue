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
    reportingCsv,
    reportingExportUnavailable,
    selectedReportingColumns,
    type ReportingColumnId,
  } from "@/lib/reporting/csv";

  const props = defineProps<{ items: EntitySummary[]; loading: boolean }>();
  const { t } = useI18n();
  const { openDialog, closeDialog } = useDialog();
  const selected = ref<ReportingColumnId[]>([]);
  const preferences = useViewPreferences();
  const unavailable = computed(() => reportingExportUnavailable(props.loading, props.items.length));
  const canDownload = computed(() => !unavailable.value && selectedReportingColumns(selected.value).length > 0);
  const hintId = useId();
  const selectionHintId = useId();

  function open() {
    if (unavailable.value) return;
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
  watch([() => props.items, () => props.loading], () => closeDialog(DialogID.ReportingCsvExport));

  function download() {
    if (!canDownload.value) return;
    let url: string | undefined;
    try {
      const csv = reportingCsv(props.items, selected.value, t);
      url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "homebox-recently-added.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      closeDialog(DialogID.ReportingCsvExport);
    } catch {
      toast.error(t("home.csv.failed"));
    } finally {
      if (url) {
        const objectUrl = url;
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
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
