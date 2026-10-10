package repo

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/sysadminsmedia/homebox/backend/internal/data/ent"
)

// TestEntityRepository_UpdateByGroup_CrossTenantLeak guards against a cross-tenant
// IDOR in the entity update path. PUT /entities/{id} calls UpdateByGroup; the update
// itself is group-scoped (a no-op across tenants), but the record returned in the
// response must also be group-scoped. Returning the entity via an unscoped lookup
// leaks another tenant's full inventory record (name, notes, purchase/sale details)
// even though nothing is written.
func TestEntityRepository_UpdateByGroup_CrossTenantLeak(t *testing.T) {
	ctx := context.Background()

	// Victim tenant: a separate group with an entity holding sensitive data.
	victimGroup, err := tRepos.Groups.GroupCreate(ctx, "victim-group", uuid.Nil)
	require.NoError(t, err)

	victimET, err := tRepos.EntityTypes.GetDefault(ctx, victimGroup.ID, false)
	require.NoError(t, err)

	const secretName = "victim-secret-serial-and-notes"
	victim, err := tRepos.Entities.Create(ctx, victimGroup.ID, EntityCreate{
		Name:         secretName,
		Description:  "confidential cross-tenant data",
		EntityTypeID: victimET.ID,
	})
	require.NoError(t, err)

	// Attacker (tGroup) attempts a PUT against the victim's entity UUID with a
	// minimal body. gid is the attacker's group, ID is the victim's entity.
	out, err := tRepos.Entities.UpdateByGroup(ctx, tGroup.ID, EntityUpdate{
		ID:   victim.ID,
		Name: "poc-test",
	})

	// The attacker must NOT receive the victim's record back.
	require.Error(t, err, "cross-tenant update must be rejected, not leak the entity")
	assert.NotEqual(t, secretName, out.Name, "victim's data must not leak through the response")
	assert.Equal(t, uuid.Nil, out.ID, "no entity should be returned to the attacker")

	// And the victim's entity must be untouched.
	stillThere, err := tRepos.Entities.GetOneByGroup(ctx, victimGroup.ID, victim.ID)
	require.NoError(t, err)
	assert.Equal(t, secretName, stillThere.Name, "victim entity must be unmodified")
}

// TestEntityRepository_UpdateByGroup_CrossTenantFieldWrite guards the nested
// custom-field sync inside UpdateByGroup. The top-level record update is
// group-scoped and silently affects zero rows for a foreign entity ID, so
// execution used to fall through to the field block, which scoped its
// create/update/delete only by entity ID. An attacker could therefore wipe or
// inject fields on another tenant's entity — blindly, since the response is a
// 404 from the group-scoped read at the end.
func TestEntityRepository_UpdateByGroup_CrossTenantFieldWrite(t *testing.T) {
	ctx := context.Background()

	victimGroup, err := tRepos.Groups.GroupCreate(ctx, "victim-group-fields", uuid.Nil)
	require.NoError(t, err)

	victimET, err := tRepos.EntityTypes.GetDefault(ctx, victimGroup.ID, false)
	require.NoError(t, err)

	victim, err := tRepos.Entities.Create(ctx, victimGroup.ID, EntityCreate{
		Name:         "victim-entity-with-fields",
		EntityTypeID: victimET.ID,
	})
	require.NoError(t, err)

	// Seed the victim entity with a custom field, as its own tenant would.
	const (
		fieldName  = "license-key"
		fieldValue = "victim-secret-value"
	)
	seeded, err := tRepos.Entities.UpdateByGroup(ctx, victimGroup.ID, EntityUpdate{
		ID:           victim.ID,
		Name:         victim.Name,
		EntityTypeID: victimET.ID,
		Fields: []EntityFieldData{
			{Name: fieldName, Type: "text", TextValue: fieldValue},
		},
	})
	require.NoError(t, err)
	require.Len(t, seeded.Fields, 1)

	// Attacker (tGroup) submits an empty fields array against the victim's
	// entity UUID: the delete branch would remove every existing field.
	_, err = tRepos.Entities.UpdateByGroup(ctx, tGroup.ID, EntityUpdate{
		ID:     victim.ID,
		Name:   "poc-test",
		Fields: []EntityFieldData{},
	})
	require.Error(t, err, "cross-tenant update must be rejected")

	// Attacker attempts to inject a new field onto the victim's entity.
	_, err = tRepos.Entities.UpdateByGroup(ctx, tGroup.ID, EntityUpdate{
		ID:   victim.ID,
		Name: "poc-test",
		Fields: []EntityFieldData{
			{Name: "attacker-injected", Type: "text", TextValue: "pwned"},
		},
	})
	require.Error(t, err, "cross-tenant update must be rejected")

	// Attacker attempts to overwrite the known field by ID.
	_, err = tRepos.Entities.UpdateByGroup(ctx, tGroup.ID, EntityUpdate{
		ID:   victim.ID,
		Name: "poc-test",
		Fields: []EntityFieldData{
			{ID: seeded.Fields[0].ID, Name: fieldName, Type: "text", TextValue: "tampered"},
		},
	})
	require.Error(t, err, "cross-tenant update must be rejected")

	// The victim's fields must be exactly as seeded: not deleted, not added
	// to, and not modified.
	after, err := tRepos.Entities.GetOneByGroup(ctx, victimGroup.ID, victim.ID)
	require.NoError(t, err)
	require.Len(t, after.Fields, 1, "victim's custom fields must not be deleted or added to")
	assert.Equal(t, fieldName, after.Fields[0].Name)
	assert.Equal(t, fieldValue, after.Fields[0].TextValue, "victim's field value must not be tampered with")
}

// TestEntityRepository_Create_CrossTenantReferencesRejectedBeforeWrite guards
// the purchase/insurance create path: a foreign parent, type or tag must fail
// before any inventory row is inserted, even when the body also carries
// purchase price, vendor and insured.
func TestEntityRepository_Create_CrossTenantReferencesRejectedBeforeWrite(t *testing.T) {
	ctx := context.Background()

	victimGroup, err := tRepos.Groups.GroupCreate(ctx, "victim-group-create-purchase", uuid.Nil)
	require.NoError(t, err)

	victimET, err := tRepos.EntityTypes.GetDefault(ctx, victimGroup.ID, false)
	require.NoError(t, err)
	victimParent, err := tRepos.Entities.Create(ctx, victimGroup.ID, EntityCreate{
		Name:         "victim-parent",
		EntityTypeID: victimET.ID,
	})
	require.NoError(t, err)
	victimTag, err := tRepos.Tags.Create(ctx, victimGroup.ID, TagCreate{Name: "victim-tag"})
	require.NoError(t, err)

	ownET, err := tRepos.EntityTypes.GetDefault(ctx, tGroup.ID, false)
	require.NoError(t, err)

	before, err := tRepos.Entities.GetAll(ctx, tGroup.ID)
	require.NoError(t, err)

	price := 16.0
	from := "should-not-land"
	insured := true
	cases := []EntityCreate{
		{
			Name:          "cross-tenant-parent",
			EntityTypeID:  ownET.ID,
			ParentID:      victimParent.ID,
			PurchasePrice: &price,
			PurchaseFrom:  &from,
			Insured:       &insured,
		},
		{
			Name:          "cross-tenant-type",
			EntityTypeID:  victimET.ID,
			PurchasePrice: &price,
			PurchaseFrom:  &from,
			Insured:       &insured,
		},
		{
			Name:          "cross-tenant-tag",
			EntityTypeID:  ownET.ID,
			TagIDs:        []uuid.UUID{victimTag.ID},
			PurchasePrice: &price,
			PurchaseFrom:  &from,
			Insured:       &insured,
		},
	}

	for _, data := range cases {
		_, err = tRepos.Entities.Create(ctx, tGroup.ID, data)
		require.Error(t, err)
		assert.True(t, ent.IsNotFound(err), "expected not-found for %s, got %v", data.Name, err)
	}

	after, err := tRepos.Entities.GetAll(ctx, tGroup.ID)
	require.NoError(t, err)
	assert.Len(t, after, len(before), "rejected creates must not insert inventory rows")

	stillThere, err := tRepos.Entities.GetOneByGroup(ctx, victimGroup.ID, victimParent.ID)
	require.NoError(t, err)
	assert.Equal(t, "victim-parent", stillThere.Name)
	assert.Empty(t, stillThere.PurchaseFrom)
	assert.False(t, stillThere.Insured)
}

func TestEntityRepository_CreateFromTemplate_CrossTenantParentRejectedBeforeWrite(t *testing.T) {
	ctx := context.Background()

	victimGroup, err := tRepos.Groups.GroupCreate(ctx, "victim-group-template-parent", uuid.Nil)
	require.NoError(t, err)
	victimET, err := tRepos.EntityTypes.GetDefault(ctx, victimGroup.ID, true)
	require.NoError(t, err)
	victimParent, err := tRepos.Entities.Create(ctx, victimGroup.ID, EntityCreate{
		Name:         "victim-location",
		EntityTypeID: victimET.ID,
	})
	require.NoError(t, err)

	before, err := tRepos.Entities.GetAll(ctx, tGroup.ID)
	require.NoError(t, err)

	_, err = tRepos.Entities.CreateFromTemplate(ctx, tGroup.ID, EntityCreateFromTemplate{
		Name:          "template-cross-tenant",
		Quantity:      1.25,
		ParentID:      victimParent.ID,
		PurchasePrice: 4,
		PurchaseFrom:  "nope",
		Insured:       true,
	})
	require.Error(t, err)
	assert.True(t, ent.IsNotFound(err))

	after, err := tRepos.Entities.GetAll(ctx, tGroup.ID)
	require.NoError(t, err)
	assert.Len(t, after, len(before))
}
