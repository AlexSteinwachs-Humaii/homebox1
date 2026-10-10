package v1

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/hay-kot/httpkit/errchain"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/sysadminsmedia/homebox/backend/internal/core/services"
	"github.com/sysadminsmedia/homebox/backend/internal/core/services/reporting/eventbus"
	"github.com/sysadminsmedia/homebox/backend/internal/data/ent"
	"github.com/sysadminsmedia/homebox/backend/internal/data/repo"
	"github.com/sysadminsmedia/homebox/backend/internal/sys/config"
	"github.com/sysadminsmedia/homebox/backend/internal/web/mid"
	_ "github.com/sysadminsmedia/homebox/backend/pkgs/cgofreesqlite"
)

type createHarness struct {
	repos *repo.AllRepos
	user  *repo.UserOut
	http  http.Handler
}

var (
	createOnce sync.Once
	createH    *createHarness
	createErr  error
)

func setupCreateHarness() (*createHarness, error) {
	createOnce.Do(func() {
		client, err := ent.Open("sqlite3", "file:entitycreate?mode=memory&cache=shared&_fk=1&_time_format=sqlite")
		if err != nil {
			createErr = err
			return
		}
		if err = client.Schema.Create(context.Background()); err != nil {
			createErr = err
			return
		}

		bus := eventbus.New()
		go func() { _ = bus.Run(context.Background()) }()

		repos := repo.New(client, bus, config.Storage{
			PrefixPath: "/",
			ConnString: "file://" + os.TempDir(),
		}, "mem://{{ .Topic }}", config.Thumbnail{})
		group, err := repos.Groups.GroupCreate(context.Background(), "create-harness", uuid.Nil)
		if err != nil {
			createErr = err
			return
		}
		password := "test-password"
		user, err := repos.Users.Create(context.Background(), repo.UserCreate{
			Name:           "Create Tester",
			Email:          "create-tester-" + uuid.NewString() + "@example.com",
			Password:       &password,
			DefaultGroupID: group.ID,
			IsOwner:        true,
		})
		if err != nil {
			createErr = err
			return
		}

		svc := services.New(repos)
		ctrl := NewControllerV1(svc, repos, bus, &config.Config{})
		chain := errchain.New(mid.Errors(zerolog.Nop()))
		router := chi.NewRouter()
		router.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				ctx := services.SetUserCtx(r.Context(), &user, "test-token")
				next.ServeHTTP(w, r.WithContext(ctx))
			})
		})
		router.Post("/entities", chain.ToHandlerFunc(ctrl.HandleEntitiesCreate()))
		router.Post("/templates/{id}/create-item", chain.ToHandlerFunc(ctrl.HandleEntityTemplatesCreateItem()))

		createH = &createHarness{repos: repos, user: &user, http: router}
	})
	return createH, createErr
}

func postJSON(t *testing.T, h http.Handler, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func decodeEntity(t *testing.T, rec *httptest.ResponseRecorder) repo.EntityOut {
	t.Helper()
	var out repo.EntityOut
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out
}

func TestHandleEntitiesCreate_OldPayloadPreservesDefaults(t *testing.T) {
	h, err := setupCreateHarness()
	require.NoError(t, err)

	rec := postJSON(t, h.http, "/entities", `{
		"name": "plain bowl",
		"description": "no purchase fields",
		"quantity": 1
	}`)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	out := decodeEntity(t, rec)
	assert.Equal(t, "plain bowl", out.Name)
	assert.Equal(t, "no purchase fields", out.Description)
	assert.InDelta(t, 1, out.Quantity, 0.000001)
	assert.Zero(t, out.PurchasePrice)
	assert.Empty(t, out.PurchaseFrom)
	assert.False(t, out.Insured)
	require.NotNil(t, out.EntityType)
	assert.False(t, out.EntityType.IsLocation)

	t.Cleanup(func() { _ = h.repos.Entities.Delete(context.Background(), out.ID) })
}

func TestHandleEntitiesCreate_PersistsPurchaseInsuranceAndFraction(t *testing.T) {
	h, err := setupCreateHarness()
	require.NoError(t, err)
	ctx := context.Background()

	locType, err := h.repos.EntityTypes.GetDefault(ctx, h.user.DefaultGroupID, true)
	require.NoError(t, err)
	location, err := h.repos.Entities.Create(ctx, h.user.DefaultGroupID, repo.EntityCreate{
		Name:         "litter shelf",
		EntityTypeID: locType.ID,
	})
	require.NoError(t, err)
	tag, err := h.repos.Tags.Create(ctx, h.user.DefaultGroupID, repo.TagCreate{Name: "cats-" + uuid.NewString()})
	require.NoError(t, err)
	itemType, err := h.repos.EntityTypes.GetDefault(ctx, h.user.DefaultGroupID, false)
	require.NoError(t, err)

	body := `{
		"name": "litter mat",
		"description": "sits by the box",
		"quantity": 1.25,
		"parentId": "` + location.ID.String() + `",
		"entityTypeId": "` + itemType.ID.String() + `",
		"tagIds": ["` + tag.ID.String() + `"],
		"purchasePrice": 16,
		"purchaseFrom": "Chewy",
		"insured": true
	}`
	rec := postJSON(t, h.http, "/entities", body)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	out := decodeEntity(t, rec)
	assert.Equal(t, "litter mat", out.Name)
	assert.Equal(t, "sits by the box", out.Description)
	assert.InDelta(t, 1.25, out.Quantity, 0.000001)
	assert.InDelta(t, 16, out.PurchasePrice, 0.000001)
	assert.Equal(t, "Chewy", out.PurchaseFrom)
	assert.True(t, out.Insured)
	require.NotNil(t, out.Parent)
	assert.Equal(t, location.ID, out.Parent.ID)
	require.NotNil(t, out.EntityType)
	assert.Equal(t, itemType.ID, out.EntityType.ID)
	require.Len(t, out.Tags, 1)
	assert.Equal(t, tag.ID, out.Tags[0].ID)

	fetched, err := h.repos.Entities.GetOneByGroup(ctx, h.user.DefaultGroupID, out.ID)
	require.NoError(t, err)
	assert.InDelta(t, 16, fetched.PurchasePrice, 0.000001)
	assert.Equal(t, "Chewy", fetched.PurchaseFrom)
	assert.True(t, fetched.Insured)
	assert.InDelta(t, 1.25, fetched.Quantity, 0.000001)

	t.Cleanup(func() {
		_ = h.repos.Entities.Delete(ctx, out.ID)
		_ = h.repos.Entities.Delete(ctx, location.ID)
		_ = h.repos.Tags.DeleteByGroup(ctx, h.user.DefaultGroupID, tag.ID)
	})
}

func TestHandleEntitiesCreate_NullPurchaseFieldsPreserveDefaults(t *testing.T) {
	h, err := setupCreateHarness()
	require.NoError(t, err)

	rec := postJSON(t, h.http, "/entities", `{
		"name": "null purchase",
		"quantity": 2,
		"purchasePrice": null,
		"purchaseFrom": null,
		"insured": null
	}`)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	out := decodeEntity(t, rec)
	assert.Zero(t, out.PurchasePrice)
	assert.Empty(t, out.PurchaseFrom)
	assert.False(t, out.Insured)
	t.Cleanup(func() { _ = h.repos.Entities.Delete(context.Background(), out.ID) })
}

func TestHandleEntitiesCreate_ExplicitFalseInsured(t *testing.T) {
	h, err := setupCreateHarness()
	require.NoError(t, err)

	rec := postJSON(t, h.http, "/entities", `{
		"name": "uninsured bowl",
		"quantity": 1,
		"purchasePrice": 0,
		"purchaseFrom": "",
		"insured": false
	}`)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	out := decodeEntity(t, rec)
	assert.False(t, out.Insured)
	assert.Zero(t, out.PurchasePrice)
	assert.Empty(t, out.PurchaseFrom)
	t.Cleanup(func() { _ = h.repos.Entities.Delete(context.Background(), out.ID) })
}

func TestHandleEntitiesCreate_RejectsInvalidPurchaseFromBeforeWrite(t *testing.T) {
	h, err := setupCreateHarness()
	require.NoError(t, err)
	ctx := context.Background()

	before, err := h.repos.Entities.GetAll(ctx, h.user.DefaultGroupID)
	require.NoError(t, err)

	rec := postJSON(t, h.http, "/entities", `{
		"name": "too-long vendor",
		"quantity": 1.5,
		"purchaseFrom": "`+strings.Repeat("a", 256)+`",
		"purchasePrice": 4,
		"insured": true
	}`)
	require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
	assert.Contains(t, rec.Body.String(), "PurchaseFrom")

	after, err := h.repos.Entities.GetAll(ctx, h.user.DefaultGroupID)
	require.NoError(t, err)
	assert.Len(t, after, len(before))
}

func TestHandleEntitiesCreate_RejectsUnauthorizedParentBeforeWrite(t *testing.T) {
	h, err := setupCreateHarness()
	require.NoError(t, err)
	ctx := context.Background()

	other, err := h.repos.Groups.GroupCreate(ctx, "other-create-"+uuid.NewString(), uuid.Nil)
	require.NoError(t, err)
	otherType, err := h.repos.EntityTypes.GetDefault(ctx, other.ID, false)
	require.NoError(t, err)
	foreign, err := h.repos.Entities.Create(ctx, other.ID, repo.EntityCreate{
		Name:         "foreign location",
		EntityTypeID: otherType.ID,
	})
	require.NoError(t, err)

	before, err := h.repos.Entities.GetAll(ctx, h.user.DefaultGroupID)
	require.NoError(t, err)

	rec := postJSON(t, h.http, "/entities", `{
		"name": "stolen parent",
		"quantity": 0.5,
		"parentId": "`+foreign.ID.String()+`",
		"purchasePrice": 12,
		"purchaseFrom": "nope",
		"insured": true
	}`)
	require.Equal(t, http.StatusNotFound, rec.Code, rec.Body.String())

	after, err := h.repos.Entities.GetAll(ctx, h.user.DefaultGroupID)
	require.NoError(t, err)
	assert.Len(t, after, len(before))
}

func TestHandleEntityTemplatesCreateItem_OverridesAndOmission(t *testing.T) {
	h, err := setupCreateHarness()
	require.NoError(t, err)
	ctx := context.Background()

	locType, err := h.repos.EntityTypes.GetDefault(ctx, h.user.DefaultGroupID, true)
	require.NoError(t, err)
	location, err := h.repos.Entities.Create(ctx, h.user.DefaultGroupID, repo.EntityCreate{
		Name:         "template shelf",
		EntityTypeID: locType.ID,
	})
	require.NoError(t, err)

	qty := 2.5
	warranty := "lifetime cover"
	manufacturer := "Acme"
	template, err := h.repos.EntityTemplates.Create(ctx, h.user.DefaultGroupID, repo.EntityTemplateCreate{
		Name:                    "insured template",
		DefaultQuantity:         &qty,
		DefaultInsured:          true,
		DefaultManufacturer:     &manufacturer,
		DefaultWarrantyDetails:  &warranty,
		DefaultLifetimeWarranty: true,
		Fields: []repo.TemplateField{
			{Name: "color", Type: "text", TextValue: "grey"},
		},
	})
	require.NoError(t, err)

	omitted := postJSON(t, h.http, "/templates/"+template.ID.String()+"/create-item", `{
		"name": "from template",
		"description": "kept defaults",
		"parentId": "`+location.ID.String()+`"
	}`)
	require.Equal(t, http.StatusCreated, omitted.Code, omitted.Body.String())
	omittedOut := decodeEntity(t, omitted)
	assert.True(t, omittedOut.Insured, "omission must keep the template insured default")
	assert.Zero(t, omittedOut.PurchasePrice)
	assert.Empty(t, omittedOut.PurchaseFrom)
	assert.InDelta(t, 2.5, omittedOut.Quantity, 0.000001)
	assert.Equal(t, "Acme", omittedOut.Manufacturer)
	assert.True(t, omittedOut.LifetimeWarranty)
	assert.Equal(t, "lifetime cover", omittedOut.WarrantyDetails)
	require.Len(t, omittedOut.Fields, 1)
	assert.Equal(t, "grey", omittedOut.Fields[0].TextValue)

	overridden := postJSON(t, h.http, "/templates/"+template.ID.String()+"/create-item", `{
		"name": "override",
		"description": "explicit false",
		"parentId": "`+location.ID.String()+`",
		"quantity": 0.25,
		"purchasePrice": 16.5,
		"purchaseFrom": "Chewy",
		"insured": false
	}`)
	require.Equal(t, http.StatusCreated, overridden.Code, overridden.Body.String())
	overOut := decodeEntity(t, overridden)
	assert.False(t, overOut.Insured, "explicit false must override a true template default")
	assert.InDelta(t, 16.5, overOut.PurchasePrice, 0.000001)
	assert.Equal(t, "Chewy", overOut.PurchaseFrom)
	assert.InDelta(t, 0.25, overOut.Quantity, 0.000001)
	assert.Equal(t, "Acme", overOut.Manufacturer)
	assert.Equal(t, "lifetime cover", overOut.WarrantyDetails)
	require.Len(t, overOut.Fields, 1)

	t.Cleanup(func() {
		_ = h.repos.Entities.Delete(ctx, omittedOut.ID)
		_ = h.repos.Entities.Delete(ctx, overOut.ID)
		_ = h.repos.Entities.Delete(ctx, location.ID)
		_ = h.repos.EntityTemplates.Delete(ctx, h.user.DefaultGroupID, template.ID)
	})
}

func TestHandleEntityTemplatesCreateItem_RejectsUnauthorizedReferences(t *testing.T) {
	h, err := setupCreateHarness()
	require.NoError(t, err)
	ctx := context.Background()

	other, err := h.repos.Groups.GroupCreate(ctx, "other-template-"+uuid.NewString(), uuid.Nil)
	require.NoError(t, err)
	otherType, err := h.repos.EntityTypes.GetDefault(ctx, other.ID, true)
	require.NoError(t, err)
	foreignLoc, err := h.repos.Entities.Create(ctx, other.ID, repo.EntityCreate{
		Name:         "foreign shelf",
		EntityTypeID: otherType.ID,
	})
	require.NoError(t, err)
	foreignTemplate, err := h.repos.EntityTemplates.Create(ctx, other.ID, repo.EntityTemplateCreate{
		Name:           "foreign template",
		DefaultInsured: true,
	})
	require.NoError(t, err)

	ownLocType, err := h.repos.EntityTypes.GetDefault(ctx, h.user.DefaultGroupID, true)
	require.NoError(t, err)
	ownLoc, err := h.repos.Entities.Create(ctx, h.user.DefaultGroupID, repo.EntityCreate{
		Name:         "own shelf",
		EntityTypeID: ownLocType.ID,
	})
	require.NoError(t, err)

	before, err := h.repos.Entities.GetAll(ctx, h.user.DefaultGroupID)
	require.NoError(t, err)

	foreignTpl := postJSON(t, h.http, "/templates/"+foreignTemplate.ID.String()+"/create-item", `{
		"name": "should not exist",
		"parentId": "`+ownLoc.ID.String()+`",
		"insured": false
	}`)
	require.Equal(t, http.StatusNotFound, foreignTpl.Code, foreignTpl.Body.String())

	foreignParent := postJSON(t, h.http, "/templates/"+mustOwnTemplate(t, h).String()+"/create-item", `{
		"name": "foreign parent",
		"parentId": "`+foreignLoc.ID.String()+`",
		"purchasePrice": 9,
		"purchaseFrom": "nope",
		"insured": true
	}`)
	require.Equal(t, http.StatusNotFound, foreignParent.Code, foreignParent.Body.String())

	after, err := h.repos.Entities.GetAll(ctx, h.user.DefaultGroupID)
	require.NoError(t, err)
	assert.Len(t, after, len(before), "rejected template creates must not insert inventory rows")
}

func mustOwnTemplate(t *testing.T, h *createHarness) uuid.UUID {
	t.Helper()
	template, err := h.repos.EntityTemplates.Create(context.Background(), h.user.DefaultGroupID, repo.EntityTemplateCreate{
		Name:           "own template " + uuid.NewString(),
		DefaultInsured: true,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = h.repos.EntityTemplates.Delete(context.Background(), h.user.DefaultGroupID, template.ID)
	})
	return template.ID
}

func TestTemplatePurchaseOverrides(t *testing.T) {
	price, from, insured := templatePurchaseOverrides(EntityTemplateCreateItemRequest{}, true)
	assert.Zero(t, price)
	assert.Empty(t, from)
	assert.True(t, insured)

	explicitPrice := 0.0
	explicitFrom := ""
	explicitInsured := false
	price, from, insured = templatePurchaseOverrides(EntityTemplateCreateItemRequest{
		PurchasePrice: &explicitPrice,
		PurchaseFrom:  &explicitFrom,
		Insured:       &explicitInsured,
	}, true)
	assert.Zero(t, price)
	assert.Empty(t, from)
	assert.False(t, insured)
}
