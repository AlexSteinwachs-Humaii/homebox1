<template>
  <form
    data-add-form
    class="flex flex-col gap-5 rounded-3xl border border-border/70 bg-card p-6 shadow-sm"
    data-testid="create-entity-form"
    :data-contextual="create.contextual.value ? 'true' : 'false'"
    :data-collection-id="create.contextual.value ? (create.context.value.collectionId ?? '') : ''"
    :data-root-id="create.context.value.rootLocationId ?? ''"
    :data-branch-id="create.context.value.branchId ?? ''"
    :data-destination-id="create.draft.locationId"
    :data-source-item-id="create.context.value.sourceItemId ?? ''"
    :data-location-state="create.rowState.value"
    autocomplete="off"
    :data-saving="create.saving.value ? 'true' : 'false'"
    :data-outcome="create.outcome.value"
    @submit.prevent="create.save()"
  >
    <fieldset :disabled="create.submitBlocked.value" class="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
      <FormTextField
        v-model="create.draft.name"
        data-testid="add-item-name"
        :label="$t('global.name')"
        :max-length="255"
        :min-length="1"
        autocomplete="off"
        @input="create.markTouched('name')"
      />
      <FormTextArea
        v-model="create.draft.description"
        data-testid="add-item-description"
        :label="$t('global.details')"
        :max-length="1000"
        @update:model-value="create.markTouched('description')"
      />

      <div class="flex flex-col gap-1.5" data-testid="add-item-location">
        <span class="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ $t("items.location") }}
        </span>
        <div
          v-if="create.rowState.value === 'ready' && !changing"
          class="flex items-center justify-between gap-3 rounded-2xl border border-input bg-background px-4 py-3"
        >
          <p class="min-w-0 truncate text-sm font-semibold" data-testid="add-item-location-path">
            {{ locationLabel }}
          </p>
          <button
            type="button"
            class="shrink-0 text-sm font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            data-testid="add-item-change-location"
            :disabled="create.saving.value"
            @click="changing = true"
          >
            {{ $t("purrfect.add_change") }}
          </button>
        </div>
        <p v-else-if="create.rowState.value === 'loading'" role="status" class="text-sm text-muted-foreground">
          {{ $t("purrfect.add_location_loading") }}
        </p>
        <p v-else-if="create.rowState.value === 'error'" role="alert" class="text-sm text-destructive">
          {{ $t("purrfect.add_locations_failed") }}
          <button type="button" class="ml-2 font-medium text-primary underline" @click="create.retryLocations()">
            {{ $t("purrfect.add_locations_retry") }}
          </button>
        </p>
        <p
          v-else-if="create.rowState.value === 'rejected'"
          role="alert"
          class="text-sm text-destructive"
          data-testid="add-location-rejected"
        >
          {{ $t("purrfect.add_location_rejected") }}
        </p>
        <LocationSelector
          v-if="changing || create.rowState.value === 'missing' || create.rowState.value === 'rejected'"
          :model-value="create.selectedLocation.value"
          @update:model-value="onLocation"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormTextField
          v-model.number="create.draft.quantity"
          data-testid="add-item-quantity"
          :label="$t('global.quantity')"
          type="number"
          step="any"
          :min="0"
          @input="create.markTouched('quantity')"
        />
        <FormTextField
          v-model="create.draft.purchasePrice"
          data-testid="add-item-price"
          :label="$t('items.purchase_price')"
          inputmode="decimal"
          autocomplete="off"
        />
      </div>
      <FormTextField
        v-model="create.draft.purchaseFrom"
        data-testid="add-item-vendor"
        :label="$t('items.purchased_from')"
        :max-length="255"
        autocomplete="off"
      />

      <div data-testid="add-item-tags" :data-state="create.tagsStatus.value">
        <p
          v-if="create.tagsStatus.value === 'loading' || create.tagsStatus.value === 'idle'"
          role="status"
          class="text-sm text-muted-foreground"
        >
          {{ $t("purrfect.add_tags_loading") }}
        </p>
        <p v-else-if="create.tagsStatus.value === 'error'" role="alert" class="text-sm text-destructive">
          {{ $t("purrfect.add_tags_failed") }}
        </p>
        <p v-else-if="create.tags.value.length === 0" class="text-sm text-muted-foreground">
          {{ $t("purrfect.add_no_tags") }}
        </p>
        <TagSelector
          v-else
          v-model="create.draft.tagIds"
          :tags="create.tags.value"
          :name="$t('purrfect.add_tags_optional')"
          @update:model-value="create.markTouched('tags')"
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-semibold">{{ $t("global.insured") }}</p>
          <p class="text-sm text-muted-foreground" data-testid="add-item-insured-hint">
            {{ create.draft.insured ? $t("purrfect.add_insured_on") : $t("purrfect.add_insured_off") }}
          </p>
        </div>
        <Switch
          :model-value="create.draft.insured"
          data-testid="add-item-insured"
          :disabled="create.saving.value"
          :aria-label="$t('global.insured')"
          @update:model-value="onInsured"
        />
      </div>
    </fieldset>

    <p v-if="create.fieldError.value" role="alert" data-testid="add-item-error" class="text-sm text-destructive">
      {{ create.fieldError.value }}
    </p>
    <p
      v-if="create.outcome.value === 'uncertain'"
      role="alert"
      data-testid="add-item-uncertain"
      class="text-sm text-destructive"
    >
      {{ $t("purrfect.add_uncertain") }}
    </p>

    <div class="flex justify-end gap-3">
      <Button
        type="button"
        variant="outline"
        class="h-11 rounded-full px-5"
        data-testid="purrfect-add-cancel"
        :disabled="create.saving.value"
        @click="create.cancel()"
      >
        {{ $t("global.cancel") }}
      </Button>
      <Button
        v-if="create.outcome.value === 'uncertain'"
        type="button"
        variant="outline"
        class="h-11 rounded-full px-5"
        data-testid="add-item-check"
        @click="create.cancel()"
      >
        {{ create.contextual.value ? $t("purrfect.add_check_origin") : $t("purrfect.add_check_home") }}
      </Button>
      <Button
        type="submit"
        class="h-11 rounded-full px-5"
        data-testid="purrfect-add-save"
        :disabled="create.submitBlocked.value || !create.draft.entityTypeId"
        :aria-busy="create.saving.value"
      >
        {{ create.saving.value ? $t("purrfect.add_saving") : $t("purrfect.add_save") }}
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
  import { Button } from "~/components/ui/button";
  import { Switch } from "~/components/ui/switch";
  import FormTextField from "~/components/Form/TextField.vue";
  import FormTextArea from "~/components/Form/TextArea.vue";
  import LocationSelector from "~/components/Location/Selector.vue";
  import TagSelector from "~/components/Tag/Selector.vue";
  import type { EntitySummary } from "~~/lib/api/types/data-contracts";
  import { LOCATION_PATH_SEPARATOR } from "~~/lib/inventory-visuals";
  import { useProvidedEntityCreate } from "~~/composables/use-entity-create";

  const create = useProvidedEntityCreate();
  const changing = ref(false);
  const locationLabel = computed(() => create.chain.value.map(part => part.name).join(` ${LOCATION_PATH_SEPARATOR} `));

  function onLocation(location: EntitySummary | null) {
    changing.value = false;
    create.markTouched("location");
    create.setLocation(location);
  }

  function onInsured(value: boolean) {
    create.draft.insured = Boolean(value);
    create.markTouched("insured");
  }

  watch(
    () => create.draft.locationId,
    () => {
      changing.value = false;
    }
  );
</script>

<style scoped>
  form[data-add-form] :deep(label) {
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
</style>
