export function itemsTable() {
  const preferences = useViewPreferences();
  const collectionId = computed(() => preferences.value.collectionId ?? null);
  const {
    data: items,
    refresh,
    status,
  } = useAsyncData(
    "items",
    async () => {
      const requestCollectionId = collectionId.value;
      const { data } = await useUserApi().items.getAll({
        page: 1,
        pageSize: 5,
        orderBy: "createdAt",
      });
      return { items: data.items, collectionId: requestCollectionId };
    },
    {
      deep: true,
      watch: [collectionId],
    }
  );

  onServerEvent(ServerEvent.EntityMutation, () => {
    console.log("entity mutation");
    refresh();
  });

  return computed(() => {
    return {
      items: items.value?.collectionId === collectionId.value ? items.value.items : [],
      collectionId: items.value?.collectionId,
      loading:
        status.value === "idle" || status.value === "pending" || items.value?.collectionId !== collectionId.value,
    };
  });
}
