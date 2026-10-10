<script setup lang="ts">
  import BaseContainer from "@/components/Base/Container.vue";
  import { useLocationHandoffContext } from "~~/composables/use-inventory-navigation";

  definePageMeta({
    middleware: ["auth"],
  });

  // The query is a hint from the item the person opened. An incompatible
  // collection is dropped here. Nothing on this page writes inventory because
  // of that hint.
  useLocationHandoffContext();
</script>

<template>
  <BaseContainer>
    <NuxtPage />
  </BaseContainer>
</template>
