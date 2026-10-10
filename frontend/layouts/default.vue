<template>
  <div id="app">
    <!--
    Confirmation Modal is a singleton used by all components so we render
    it here to ensure it's always available. Possibly could move this further
    up the tree
    -->
    <ModalConfirm />
    <OutdatedModal v-if="status" :status="status" />
    <EntityCreateModal />
    <WipeInventoryDialog />
    <TagCreateModal />
    <ItemBarcodeModal />
    <AppQuickMenuModal :actions="quickMenuActions" />
    <AppScannerModal />
    <CollectionCreateModal />
    <CollectionJoinModal />
    <CollectionInviteCreateModal />
    <SidebarProvider :default-open="sidebarState">
      <template v-if="isPurrfectDesktop">
        <Sidebar
          collapsible="none"
          class="sticky top-0 h-dvh border-r border-sidebar-border"
          :style="{ '--sidebar-width': '15rem' }"
        >
          <SidebarHeader class="gap-4 px-3 pb-2 pt-5">
            <NuxtLink to="/home" class="flex items-center gap-2 rounded-xl p-1 text-sidebar-foreground">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" class="size-5" fill="none">
                  <path
                    d="M8 6.5 14.5 12 8 17.5"
                    stroke="currentColor"
                    stroke-width="2.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="text-lg font-semibold tracking-tight">HomeBox</span>
            </NuxtLink>
            <CollectionSelector
              expanded
              trigger-class="rounded-full border-border/70 bg-background font-semibold shadow-none"
            />
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <nav :aria-label="$t('global.navigate')">
                <SidebarMenu>
                  <SidebarMenuItem v-for="n in purrfectPrimaryNav" :key="n.id">
                    <NuxtLink
                      :to="n.to"
                      class="flex h-10 items-center rounded-xl px-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent/80"
                      :class="n.active.value ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : ''"
                      :aria-current="n.active.value ? 'page' : undefined"
                    >
                      {{ n.name.value }}
                    </NuxtLink>
                  </SidebarMenuItem>
                </SidebarMenu>
              </nav>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel class="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {{ $t("menu.manage") }}
              </SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem v-for="n in purrfectManageNav" :key="n.id">
                  <NuxtLink
                    :to="n.to"
                    class="flex h-10 items-center rounded-xl px-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent/80"
                    :class="n.active.value ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : ''"
                    :aria-current="n.active.value ? 'page' : undefined"
                  >
                    {{ n.name.value }}
                  </NuxtLink>
                </SidebarMenuItem>
                <SidebarMenuItem v-if="collectionNav">
                  <Collapsible class="group/collapsible">
                    <div class="flex items-center gap-1">
                      <NuxtLink
                        :to="collectionNav.to"
                        class="flex h-10 min-w-0 flex-1 items-center rounded-xl px-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent/80"
                        :class="
                          collectionNav.active.value
                            ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                            : ''
                        "
                        :aria-current="collectionNav.active.value ? 'page' : undefined"
                      >
                        {{ collectionNav.name.value }}
                      </NuxtLink>
                      <CollapsibleTrigger as-child>
                        <button
                          type="button"
                          class="flex size-10 shrink-0 items-center justify-center rounded-xl text-sidebar-foreground hover:bg-sidebar-accent/80"
                          :aria-label="$t('menu.collection_sections')"
                        >
                          <MdiChevronRight
                            class="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                          />
                        </button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem v-for="c in collectionNav.collapsible" :key="c.id">
                          <NuxtLink
                            :to="c.to"
                            class="flex h-8 items-center rounded-lg px-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/80"
                            :class="
                              c.active.value ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : ''
                            "
                            :aria-current="c.active.value ? 'page' : undefined"
                          >
                            {{ c.name.value }}
                          </NuxtLink>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter class="border-t border-sidebar-border px-3 py-4">
            <div class="flex min-w-0 items-center gap-2 text-sm text-sidebar-foreground">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium"
                aria-hidden="true"
              >
                {{ initials }}
              </span>
              <span class="truncate font-medium">{{ username }}</span>
              <span aria-hidden="true">·</span>
              <NuxtLink
                to="/profile"
                class="shrink-0 rounded-md hover:underline"
                :aria-current="route.path === '/profile' ? 'page' : undefined"
              >
                {{ $t("menu.profile") }}
              </NuxtLink>
            </div>
            <button
              type="button"
              class="px-1 text-left text-sm text-muted-foreground hover:text-foreground"
              data-testid="logout-button"
              @click="logout"
            >
              {{ $t("global.sign_out") }}
            </button>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset data-shell="purrfect" class="min-h-dvh max-w-full overflow-hidden bg-background">
          <div class="relative flex h-full flex-col">
            <header class="sticky top-0 z-20 border-b border-border/50 bg-background px-6 py-4">
              <div class="flex items-center gap-3">
                <form class="min-w-0 flex-1" role="search" @submit.prevent="triggerSearch">
                  <label class="sr-only" for="purrfect-search">{{ $t("menu.search") }}</label>
                  <Input
                    id="purrfect-search"
                    v-model:model-value="search"
                    class="h-11 rounded-full border-border/70 bg-card px-4"
                    :placeholder="searchPlaceholder"
                    type="search"
                    name="q"
                    data-testid="purrfect-search"
                  />
                </form>
                <Button
                  type="button"
                  variant="outline"
                  class="h-11 rounded-full px-5"
                  data-testid="purrfect-scan"
                  @click="openScanner"
                >
                  {{ $t("menu.scan") }}
                </Button>
                <Button
                  type="button"
                  class="h-11 rounded-full px-5"
                  data-testid="purrfect-add-item"
                  @click="launchAddItem()"
                >
                  <span aria-hidden="true">+</span>
                  {{ $t("menu.add_item") }}
                </Button>
              </div>
            </header>

            <slot />
            <div class="grow" />

            <footer v-if="status" class="bottom-0 w-full pb-4 text-center">
              <p class="text-center text-sm">
                <span
                  v-html="
                    DOMPurify.sanitize(
                      $t('global.footer.version_link', {
                        version: status.build.version.replace(/^v/, ''),
                        build: status.build.commit,
                      })
                    )
                  "
                />
                ~
                <span v-html="DOMPurify.sanitize($t('global.footer.api_link'))" />
              </p>
            </footer>
          </div>
        </SidebarInset>
      </template>
      <template v-else>
        <Sidebar collapsible="icon">
          <SidebarHeader class="items-center">
            <SidebarGroupLabel class="text-base group-data-[collapsible=icon]:hidden">{{
              $t("global.welcome", { username: username })
            }}</SidebarGroupLabel>
            <NuxtLink class="group-data-[collapsible=icon]:hidden" to="/home">
              <div class="flex size-24 items-center justify-center rounded-full bg-background-accent p-4">
                <AppLogo />
              </div>
            </NuxtLink>

            <CollectionSelector />

            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <SidebarMenuButton
                  class="flex justify-center bg-primary text-primary-foreground drop-shadow-md hover:bg-primary/90 active:bg-primary/90 active:text-primary-foreground group-data-[collapsible=icon]:justify-start"
                  :tooltip="$t('global.create')"
                  hotkey="Shortcut: Ctrl+`"
                >
                  <MdiPlus />
                  <span>
                    {{ $t("global.create") }}
                  </span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent class="z-40 min-w-[var(--reka-dropdown-menu-trigger-width)]">
                <DropdownMenuItem
                  v-for="btn in dropdown"
                  :key="btn.id"
                  class="group cursor-pointer text-lg"
                  @click="
                    () => {
                      if (btn.dialogId === DialogID.CreateEntity) {
                        if (btn.id == 0)
                          // create item
                          openDialog(btn.dialogId, { params: { baseType: 'item' } });
                        else if (btn.id == 1)
                          // create location
                          openDialog(btn.dialogId, { params: { baseType: 'location' } });
                      } else {
                        openDialog(btn.dialogId as NoParamDialogIDs);
                      }
                    }
                  "
                >
                  {{ btn.name.value }}
                  <Shortcut
                    v-if="btn.shortcut"
                    class="invisible ml-auto group-hover:visible"
                    :keys="btn.shortcut.replace('Shift', '⇧').split('+')"
                  />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <template v-for="n in nav" :key="n.id">
                  <SidebarMenuItem v-if="!n.collapsible" :key="n.id">
                    <SidebarMenuLink
                      :href="n.to"
                      :class="{
                        'bg-accent text-accent-foreground': n.active?.value,
                        'text-nowrap': typeof locale === 'string' && locale.startsWith('zh-'),
                      }"
                      :tooltip="n.name.value"
                    >
                      <component :is="n.icon" />
                      <span>{{ n.name.value }}</span>
                    </SidebarMenuLink>
                  </SidebarMenuItem>

                  <Collapsible v-else default-open class="group/collapsible">
                    <SidebarMenuItem>
                      <SidebarMenuItem class="flex gap-1">
                        <SidebarMenuLink
                          :href="n.to"
                          :class="{
                            'bg-accent text-accent-foreground': n.active?.value,
                            'text-nowrap': typeof locale === 'string' && locale.startsWith('zh-'),
                          }"
                          :tooltip="n.name.value"
                        >
                          <component :is="n.icon" />
                          <span>{{ n.name.value }}</span>
                        </SidebarMenuLink>
                        <CollapsibleTrigger as-child>
                          <SidebarMenuButton class="flex size-12 items-center justify-center">
                            <MdiChevronRight
                              class="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                            />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                      </SidebarMenuItem>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <SidebarMenuSubItem v-for="c in n.collapsible" :key="c.id">
                            <SidebarMenuLink
                              :href="c.to"
                              :class="{
                                'bg-accent text-accent-foreground': c.active?.value,
                                'text-nowrap': typeof locale === 'string' && locale.startsWith('zh-'),
                                'h-min py-0': true,
                              }"
                              :tooltip="c.name.value"
                            >
                              <span>{{ c.name.value }}</span>
                            </SidebarMenuLink>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </template>

                <!-- makes scanner accessible easily if using legacy header -->
                <SidebarMenuItem v-if="preferences.displayLegacyHeader">
                  <SidebarMenuButton
                    :class="{
                      'text-nowrap': typeof locale === 'string' && locale.startsWith('zh-'),
                    }"
                    :tooltip="$t('menu.scanner')"
                    @click.prevent="openDialog(DialogID.Scanner)"
                  >
                    <MdiQrcodeScan />
                    <span>{{ $t("menu.scanner") }}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenuButton
              class="flex justify-center group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:bg-destructive group-data-[collapsible=icon]:text-destructive-foreground group-data-[collapsible=icon]:shadow-sm group-data-[collapsible=icon]:hover:bg-destructive/90"
              :tooltip="$t('global.sign_out')"
              data-testid="logout-button"
              @click="logout"
            >
              <MdiLogout />
              <span>
                {{ $t("global.sign_out") }}
              </span>
            </SidebarMenuButton>
          </SidebarFooter>

          <SidebarRail />
        </Sidebar>
        <SidebarInset class="min-h-dvh max-w-full overflow-hidden bg-background-accent">
          <div class="relative flex h-full flex-col justify-center">
            <div v-if="preferences.displayLegacyHeader">
              <AppHeaderDecor class="-mt-10 hidden lg:block" />
              <SidebarTrigger class="absolute left-2 top-2 hidden lg:flex" variant="default" />
            </div>
            <!-- IMPORTANT: if you change the height of this div, alter the top value in the item edit page-->
            <div
              class="sticky top-0 z-20 flex h-[var(--header-height-mobile)] translate-y-[-0.5px] flex-col bg-secondary p-2 shadow-md sm:h-[var(--header-height)] sm:flex-row"
              :class="{
                'lg:hidden': preferences.displayLegacyHeader,
              }"
            >
              <div class="flex h-1/2 items-center gap-2 sm:h-auto">
                <SidebarTrigger variant="default" />
                <NuxtLink to="/home">
                  <AppHeaderText class="h-6" />
                </NuxtLink>
              </div>
              <div class="sm:grow" />
              <div class="flex h-1/2 grow items-center justify-end gap-2 sm:h-auto">
                <Input
                  v-model:model-value="search"
                  class="h-9 grow sm:max-w-sm"
                  :placeholder="$t('global.search')"
                  type="search"
                  @keyup.enter="triggerSearch"
                />
                <div>
                  <Button size="icon" @click="triggerSearch">
                    <MdiMagnify />
                  </Button>
                </div>
                <div>
                  <Button size="icon" @click="openScanner">
                    <MdiQrcodeScan />
                  </Button>
                </div>
              </div>
            </div>

            <slot />
            <div class="grow" />

            <footer v-if="status" class="bottom-0 w-full pb-4 text-center">
              <p class="text-center text-sm">
                <span
                  v-html="
                    DOMPurify.sanitize(
                      $t('global.footer.version_link', {
                        version: status.build.version.replace(/^v/, ''),
                        build: status.build.commit,
                      })
                    )
                  "
                />
                ~
                <span v-html="DOMPurify.sanitize($t('global.footer.api_link'))" />
              </p>
            </footer>
          </div>
        </SidebarInset>
      </template>
    </SidebarProvider>
  </div>
</template>

<script lang="ts" setup>
  import { useI18n } from "vue-i18n";
  import DOMPurify from "dompurify";
  import { useTagStore } from "~/stores/tags";
  import { useLocationStore } from "~~/stores/locations";
  import { useEntityTypeStore } from "~~/stores/entityTypes";

  import MdiHome from "~icons/mdi/home";
  import MdiFileTree from "~icons/mdi/file-tree";
  import MdiTagMultiple from "~icons/mdi/tag-multiple";
  import MdiMagnify from "~icons/mdi/magnify";
  import MdiQrcodeScan from "~icons/mdi/qrcode-scan";
  import MdiAccount from "~icons/mdi/account";
  import MdiCog from "~icons/mdi/cog";
  import MdiWrench from "~icons/mdi/wrench";
  import MdiPlus from "~icons/mdi/plus";
  import MdiLogout from "~icons/mdi/logout";
  import MdiFileDocumentMultiple from "~icons/mdi/file-document-multiple";
  import MdiChevronRight from "~icons/mdi/chevron-right";

  import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuLink,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
  } from "@/components/ui/sidebar";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
  import { Shortcut } from "~/components/ui/shortcut";
  import { useMediaQuery } from "@vueuse/core";
  import { useDialog } from "~/components/ui/dialog-provider";
  import { Input } from "~/components/ui/input";
  import { Button } from "~/components/ui/button";
  import { toast } from "@/components/ui/sonner";
  import { DialogID, type NoParamDialogIDs } from "~/components/ui/dialog-provider/utils";
  import { itemsSearchHref, PURRFECT_DESKTOP_MEDIA_QUERY } from "~~/lib/inventory-context";
  import ModalConfirm from "~/components/ModalConfirm.vue";
  import OutdatedModal from "~/components/App/OutdatedModal.vue";
  import EntityCreateModal from "~/components/Entity/CreateModal.vue";
  import WipeInventoryDialog from "~/components/WipeInventoryDialog.vue";
  import TagCreateModal from "~/components/Tag/CreateModal.vue";
  import ItemBarcodeModal from "~/components/Item/BarcodeModal.vue";
  import AppQuickMenuModal from "~/components/App/QuickMenuModal.vue";
  import AppScannerModal from "~/components/App/ScannerModal.vue";
  import AppLogo from "~/components/App/Logo.vue";
  import AppHeaderDecor from "~/components/App/HeaderDecor.vue";
  import AppHeaderText from "~/components/App/HeaderText.vue";
  import CollectionSelector from "~/components/Collection/Selector.vue";
  import CollectionCreateModal from "~/components/Collection/CreateModal.vue";
  import CollectionJoinModal from "~/components/Collection/JoinModal.vue";
  import CollectionInviteCreateModal from "~/components/Collection/InviteCreateModal.vue";

  const { t, locale } = useI18n();
  const username = computed(() => authCtx.user?.name || "User");
  const initials = computed(() => {
    const parts = username.value.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }
    return (username.value.trim().slice(0, 2) || "?").toUpperCase();
  });

  const { openDialog } = useDialog();
  const { theme } = useTheme();
  const isDesktop = useMediaQuery(PURRFECT_DESKTOP_MEDIA_QUERY);
  const isPurrfectDesktop = computed(() => theme.value === "purrfect-home" && isDesktop.value);
  const { launchAddItem } = useInventoryNavigation();
  const { selectedCollection } = useCollections();
  const searchPlaceholder = computed(() => {
    const name = selectedCollection.value?.name;
    return name ? t("purrfect.search_placeholder", { collection: name }) : t("purrfect.search_placeholder_generic");
  });

  const preferences = useViewPreferences();

  // get sidebar state from cookies
  const sidebarState = useCookie("sidebar:state", {
    readonly: true,
    decode: value => value !== "false",
  });

  const pubApi = usePublicApi();
  const { data: status } = useAsyncData(async () => {
    const { data } = await pubApi.status();

    return data;
  });

  const search = ref("");

  const triggerSearch = () => {
    const href = itemsSearchHref(search.value);
    if (href) {
      navigateTo(href);
      search.value = "";
      // remove focus from input
      if (document.activeElement && "blur" in document.activeElement) {
        (document.activeElement as HTMLElement).blur();
      }
    }
  };

  const openScanner = () => {
    // request permission
    if (navigator.mediaDevices) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(() => {
          openDialog(DialogID.Scanner);
        })
        .catch(err => {
          console.error(err);
          toast.error(t("scanner.permission_denied"));
        });
    } else {
      toast.error(t("scanner.unsupported"));
    }
  };

  // Preload currency format
  useFormatCurrency();

  type DropdownItem = {
    id: number;
    name: ComputedRef<string>;
    shortcut: string;
    dialogId: DialogID;
  };

  const dropdown: DropdownItem[] = [
    {
      id: 0,
      name: computed(() => t("menu.create_item")),
      shortcut: "Shift+1",
      dialogId: DialogID.CreateEntity,
    },
    {
      id: 1,
      name: computed(() => t("menu.create_location")),
      shortcut: "Shift+2",
      dialogId: DialogID.CreateEntity,
    },
    {
      id: 2,
      name: computed(() => t("menu.create_tag")),
      shortcut: "Shift+3",
      dialogId: DialogID.CreateTag,
    },
  ];

  const route = useRoute();
  const router = useRouter();

  const nav: {
    icon: Component;
    active: ComputedRef<boolean>;
    id: number;
    name: ComputedRef<string>;
    to: string;
    collapsible?: {
      active: ComputedRef<boolean>;
      id: number;
      name: ComputedRef<string>;
      to: string;
    }[];
  }[] = [
    {
      icon: MdiHome,
      active: computed(() => route.path === "/home"),
      id: 0,
      name: computed(() => t("menu.home")),
      to: "/home",
    },
    {
      icon: MdiFileTree,
      id: 1,
      active: computed(() => route.path === "/locations"),
      name: computed(() => t("menu.locations")),
      to: "/locations",
    },
    {
      icon: MdiTagMultiple,
      id: 2,
      active: computed(() => route.path === "/tags"),
      name: computed(() => t("global.tags")),
      to: "/tags",
    },
    {
      icon: MdiMagnify,
      id: 3,
      active: computed(() => route.path === "/items"),
      name: computed(() => t("menu.search")),
      to: "/items",
    },
    {
      icon: MdiFileDocumentMultiple,
      id: 4,
      active: computed(() => route.path === "/templates"),
      name: computed(() => t("menu.templates")),
      to: "/templates",
    },
    {
      icon: MdiWrench,
      id: 5,
      active: computed(() => route.path === "/maintenance"),
      name: computed(() => t("menu.maintenance")),
      to: "/maintenance",
    },
    {
      icon: MdiAccount,
      id: 6,
      active: computed(() => route.path === "/profile"),
      name: computed(() => t("menu.profile")),
      to: "/profile",
    },
    {
      icon: MdiCog,
      id: 7,
      active: computed(() => route.path.includes("/collection")),
      name: computed(() => t("menu.collection")),
      to: "/collection/members",
      collapsible: [
        {
          id: 61,
          active: computed(() => route.path === "/collection/members"),
          name: computed(() => t("collection.tabs.members")),
          to: "/collection/members",
        },
        {
          id: 62,
          active: computed(() => route.path === "/collection/invites"),
          name: computed(() => t("collection.tabs.invites")),
          to: "/collection/invites",
        },
        {
          id: 63,
          active: computed(() => route.path === "/collection/notifiers"),
          name: computed(() => t("collection.tabs.notifiers")),
          to: "/collection/notifiers",
        },
        {
          id: 64,
          active: computed(() => route.path === "/collection/settings"),
          name: computed(() => t("collection.tabs.settings")),
          to: "/collection/settings",
        },
        {
          id: 65,
          active: computed(() => route.path === "/collection/entity-types"),
          name: computed(() => t("collection.tabs.entity_types")),
          to: "/collection/entity-types",
        },
        {
          id: 66,
          active: computed(() => route.path === "/collection/tools"),
          name: computed(() => t("collection.tabs.tools")),
          to: "/collection/tools",
        },
      ],
    },
  ];

  const navById = (id: number) => nav.find(item => item.id === id);
  const purrfectPrimaryNav = [0, 3, 1, 2].flatMap(id => {
    const item = navById(id);
    return item ? [item] : [];
  });
  const purrfectManageNav = [4, 5].flatMap(id => {
    const item = navById(id);
    return item ? [item] : [];
  });
  const collectionNav = navById(7);

  const quickMenuActions = reactive([
    ...dropdown.map(v => ({
      text: computed(() => v.name.value),
      dialogId: v.dialogId,
      shortcut: v.shortcut.split("+")[1] as string,
      id: v.id,
      type: "create" as const,
    })),
    ...nav.map(v => ({
      text: computed(() => v.name.value),
      href: v.to,
      type: "navigate" as const,
    })),
  ]);

  const tagStore = useTagStore();
  tagStore.ensureAllTagsFetched();

  const locationStore = useLocationStore();
  locationStore.ensureLocationsFetched();

  const entityTypeStore = useEntityTypeStore();
  entityTypeStore.ensureFetched();

  onMounted(() => {
    locationStore.refreshParents();
    locationStore.refreshTree();

    // Auto-open JoinModal when invitation token is in URL
    const token = route.query.token;
    if (typeof token === "string" && token.length > 0) {
      // Remove token from browser URL
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState(history.state, "", url.toString());

      // Sync router's state to clear route.query.token
      const { token: _, ...cleanQuery } = route.query;
      router.replace({ query: cleanQuery });

      openDialog(DialogID.JoinCollection, {
        params: { inviteCode: token },
      });
    }
  });

  onServerEvent(ServerEvent.TagMutation, () => {
    tagStore.refresh();
  });

  onServerEvent(ServerEvent.EntityMutation, () => {
    locationStore.refreshChildren();
    locationStore.refreshParents();
    locationStore.refreshTree();
  });

  const authCtx = useAuthContext();
  const api = useUserApi();

  async function logout() {
    await authCtx.logout(api);
    navigateTo("/");
  }
</script>
