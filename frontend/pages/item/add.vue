<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Button } from "~/components/ui/button";
  import EntityCreateForm from "~/components/Entity/CreateForm.vue";
  import EntitySelector from "~/components/Entity/Selector.vue";
  import TemplateSelector from "~/components/Template/Selector.vue";
  import EntityImage from "~/components/Inventory/EntityImage.vue";
  import Currency from "~/components/global/Currency.vue";
  import { provideEntityCreate } from "~~/composables/use-entity-create";

  definePageMeta({
    middleware: ["auth"],
  });

  const { t } = useI18n();
  useHead({ title: "HomeBox | " + t("purrfect.add_title") });

  const create = provideEntityCreate();

  function crumbHref(id: string) {
    return `/location/${id}`;
  }
</script>

<template>
  <div data-testid="purrfect-add" class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
    <nav :aria-label="$t('global.navigate')" data-testid="add-item-breadcrumb">
      <ol class="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <li>
          <NuxtLink to="/home" class="hover:text-foreground hover:underline">
            {{ create.collectionName.value || $t("purrfect.search_collection_fallback") }}
          </NuxtLink>
        </li>
        <li v-for="part in create.chain.value" :key="part.id" class="flex items-center gap-1">
          <span aria-hidden="true">›</span>
          <NuxtLink :to="crumbHref(part.id)" class="font-medium text-primary hover:underline">
            {{ part.name }}
          </NuxtLink>
        </li>
      </ol>
    </nav>

    <div>
      <h1 class="text-4xl font-semibold tracking-tight">{{ $t("purrfect.add_title") }}</h1>
      <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
        {{ create.contextual.value ? $t("purrfect.add_subtitle_context") : $t("purrfect.add_subtitle_global") }}
      </p>
    </div>

    <div
      v-if="create.templateData.value"
      class="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
      data-testid="add-item-template"
    >
      <div class="flex items-start justify-between gap-3">
        <p>
          {{ $t("components.template.using_template", { name: create.templateData.value.name }) }}
          <span v-if="create.contextual.value" class="mt-1 block text-muted-foreground">
            {{ $t("purrfect.add_template_kept_location") }}
          </span>
        </p>
        <button type="button" class="text-sm font-medium text-primary underline" @click="create.clearTemplate()">
          {{ $t("components.entity.create_modal.clear_template") }}
        </button>
      </div>
    </div>

    <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <EntityCreateForm />

      <aside class="flex flex-col gap-4">
        <div
          class="flex flex-col items-center justify-center gap-3 rounded-3xl bg-accent px-6 py-8 text-accent-foreground"
          data-testid="add-item-illustration"
          data-decorative="true"
          data-upload="false"
        >
          <svg viewBox="0 0 160 96" class="h-24 w-40" aria-hidden="true" focusable="false">
            <ellipse cx="80" cy="62" rx="58" ry="16" fill="currentColor" opacity="0.18" />
            <ellipse cx="80" cy="52" rx="46" ry="14" fill="none" stroke="currentColor" stroke-width="3" />
            <ellipse cx="80" cy="46" rx="22" ry="8" fill="currentColor" opacity="0.35" />
          </svg>
          <p class="text-center text-sm text-muted-foreground">{{ $t("purrfect.add_no_photo") }}</p>
        </div>

        <section
          class="rounded-3xl border border-border/70 bg-card p-4"
          data-testid="shelf-preview"
          :data-state="create.shelfPhase.value"
          :data-location-id="create.draft.locationId"
        >
          <h2 class="text-base font-semibold">{{ $t("purrfect.add_shelf_title") }}</h2>
          <p v-if="create.shelfPhase.value === 'absent'" class="mt-3 text-sm text-muted-foreground">
            {{ $t("purrfect.add_shelf_absent") }}
          </p>
          <p v-else-if="create.shelfPhase.value === 'loading'" role="status" class="mt-3 text-sm text-muted-foreground">
            {{ $t("purrfect.add_shelf_loading") }}
          </p>
          <p v-else-if="create.shelfPhase.value === 'empty'" class="mt-3 text-sm text-muted-foreground">
            {{ $t("purrfect.add_shelf_empty") }}
          </p>
          <div v-else-if="create.shelfPhase.value === 'error'" role="alert" class="mt-3 text-sm">
            <p>{{ $t("purrfect.add_shelf_error") }}</p>
            <button
              type="button"
              class="mt-2 font-medium text-primary underline"
              data-testid="shelf-preview-retry"
              @click="create.retryPreview()"
            >
              {{ $t("purrfect.add_shelf_retry") }}
            </button>
          </div>
          <ul v-else class="mt-2 divide-y divide-border/70">
            <li
              v-for="row in create.previewRows.value"
              :key="row.id"
              class="flex items-center gap-3 py-2"
              data-testid="shelf-item"
              :data-item-id="row.id"
            >
              <EntityImage
                class="size-10 shrink-0 rounded-lg"
                :entity-id="row.id"
                :name="row.name"
                :image-id="row.imageId"
                :thumbnail-id="row.thumbnailId"
              />
              <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ row.name }}</span>
              <span class="shrink-0 text-sm text-muted-foreground" data-testid="shelf-item-price">
                <Currency v-if="row.purchasePrice != null" :amount="row.purchasePrice" />
                <template v-else>{{ $t("purrfect.add_shelf_price_missing") }}</template>
              </span>
            </li>
          </ul>
          <p
            v-if="create.previewPartial.value"
            class="mt-2 text-xs text-muted-foreground"
            data-testid="shelf-preview-partial"
          >
            {{ $t("purrfect.add_shelf_partial", { shown: create.previewRows.value.length }) }}
          </p>
        </section>
      </aside>
    </div>

    <details class="rounded-2xl border border-border/70 bg-card px-4 py-3" data-testid="add-item-advanced">
      <summary class="cursor-pointer text-sm font-medium">{{ $t("purrfect.add_advanced") }}</summary>
      <p class="mt-2 text-sm text-muted-foreground">{{ $t("purrfect.add_advanced_hint") }}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <EntitySelector
          v-if="create.entityTypes.value.length > 0"
          :entity-types="create.entityTypes.value"
          :selected-entity-type="create.selectedEntityType.value?.id"
          :on-entity-type-changed="create.onEntityTypeChanged"
        />
        <TemplateSelector :model-value="create.selectedTemplate.value" @template-selected="create.selectTemplate" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="add-advanced-scan"
          :disabled="create.submitBlocked.value"
          @click="create.openScanner()"
        >
          {{ $t("purrfect.add_scan") }}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="add-advanced-barcode"
          :disabled="create.submitBlocked.value"
          @click="create.openBarcode()"
        >
          {{ $t("purrfect.add_barcode") }}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="add-advanced-location"
          :disabled="create.submitBlocked.value"
          @click="create.openLocationCreate()"
        >
          {{ $t("purrfect.add_create_location") }}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="add-advanced-existing"
          :disabled="create.submitBlocked.value"
          @click="create.openExistingForm()"
        >
          {{ $t("purrfect.add_existing_form") }}
        </Button>
      </div>
    </details>

    <p
      class="self-end rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground"
      data-testid="purrfect-theme-label"
    >
      {{ $t("purrfect.optional_theme") }}
    </p>
  </div>
</template>
