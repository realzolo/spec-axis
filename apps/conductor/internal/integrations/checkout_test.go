package integrations

import "testing"

func TestBuildCheckoutRemoteURLForGitHubSlug(t *testing.T) {
	got, err := buildCheckoutRemoteURL("realzolo/spec-axis", "github", nil)
	if err != nil {
		t.Fatalf("buildCheckoutRemoteURL returned error: %v", err)
	}
	want := "https://github.com/realzolo/spec-axis.git"
	if got != want {
		t.Fatalf("unexpected remote URL: got %q want %q", got, want)
	}
}

func TestBuildCheckoutRemoteURLForGitHubEnterpriseAPIBase(t *testing.T) {
	got, err := buildCheckoutRemoteURL("team/repo", "github", []byte(`{"baseUrl":"https://ghe.example.com/api/v3"}`))
	if err != nil {
		t.Fatalf("buildCheckoutRemoteURL returned error: %v", err)
	}
	want := "https://ghe.example.com/team/repo.git"
	if got != want {
		t.Fatalf("unexpected remote URL: got %q want %q", got, want)
	}
}

func TestBuildCheckoutEnvUsesHTTPHeaderAuth(t *testing.T) {
	env := buildCheckoutEnv("github", "top-secret", "https://github.com/realzolo/spec-axis.git")
	if env["GIT_TERMINAL_PROMPT"] != "0" {
		t.Fatalf("expected GIT_TERMINAL_PROMPT=0, got %q", env["GIT_TERMINAL_PROMPT"])
	}
	if env["GIT_CONFIG_COUNT"] != "2" {
		t.Fatalf("expected GIT_CONFIG_COUNT=2, got %q", env["GIT_CONFIG_COUNT"])
	}
	if env["GIT_CONFIG_KEY_0"] != "http.extraHeader" {
		t.Fatalf("unexpected auth config key: %q", env["GIT_CONFIG_KEY_0"])
	}
	if env["GIT_CONFIG_VALUE_0"] == "" {
		t.Fatal("expected auth header to be populated")
	}
}
