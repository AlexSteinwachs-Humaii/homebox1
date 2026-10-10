package repo

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestEntitySummarySerializesKnownZeroItemCount(t *testing.T) {
	zero := 0.0
	body, err := json.Marshal(EntitySummary{
		Name:      "Empty shelf",
		ItemCount: &zero,
	})
	if err != nil {
		t.Fatal(err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(body, &decoded); err != nil {
		t.Fatal(err)
	}
	count, ok := decoded["itemCount"].(float64)
	if !ok || count != 0 {
		t.Fatalf("known zero count = %#v, body %s", decoded["itemCount"], body)
	}
}

func TestEntitySummaryOmitsUnknownItemCount(t *testing.T) {
	body, err := json.Marshal(EntitySummary{Name: "Uncounted"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(body), "itemCount") {
		t.Fatalf("unknown count was serialized as a number: %s", body)
	}
}
