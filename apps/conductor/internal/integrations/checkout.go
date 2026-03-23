package integrations

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/url"
	"strings"

	"sykra/conductor/internal/crypto"
	"sykra/conductor/internal/store"
)

type CheckoutSpec struct {
	Repository string
	RemoteURL  string
	Env        map[string]string
}

func ResolveCheckoutSpec(ctx context.Context, st *store.Store, project *store.Project) (*CheckoutSpec, error) {
	if project == nil {
		return nil, fmt.Errorf("project is required")
	}
	repository := strings.TrimSpace(project.Repo)
	if repository == "" {
		return nil, fmt.Errorf("project has no repository configured")
	}

	integration, err := resolveIntegration(ctx, st, project, "vcs")
	if err != nil {
		return nil, err
	}

	token, err := crypto.DecryptSecret(integration.VaultSecretName)
	if err != nil {
		return nil, wrapSecretDecryptError("VCS", err)
	}

	remoteURL, err := buildCheckoutRemoteURL(repository, integration.Provider, integration.Config)
	if err != nil {
		return nil, err
	}

	return &CheckoutSpec{
		Repository: repository,
		RemoteURL:  remoteURL,
		Env:        buildCheckoutEnv(integration.Provider, token, remoteURL),
	}, nil
}

func buildCheckoutRemoteURL(repository string, provider string, configRaw []byte) (string, error) {
	if isRemoteURL(repository) {
		return ensureGitSuffixForURL(repository), nil
	}

	repoPath := normalizeRepoPath(repository)
	switch strings.TrimSpace(strings.ToLower(provider)) {
	case "github":
		baseURL := normalizeGitHubCloneBaseURL(readConfigString(configRaw, "baseUrl"))
		return stripTrailingSlash(baseURL) + "/" + repoPath + ".git", nil
	case "gitlab":
		baseURL := normalizeGitLabCloneBaseURL(readConfigString(configRaw, "baseUrl"))
		return stripTrailingSlash(baseURL) + "/" + repoPath + ".git", nil
	case "git":
		baseURL := strings.TrimSpace(readConfigString(configRaw, "baseUrl"))
		if baseURL == "" {
			return "", fmt.Errorf("generic git integration requires baseUrl")
		}
		return stripTrailingSlash(baseURL) + "/" + repoPath + ".git", nil
	default:
		return "", fmt.Errorf("unsupported VCS provider: %s", provider)
	}
}

func buildCheckoutEnv(provider string, token string, remoteURL string) map[string]string {
	env := map[string]string{
		"GIT_TERMINAL_PROMPT": "0",
	}
	if strings.TrimSpace(token) == "" || !isHTTPURL(remoteURL) {
		return env
	}

	username := "git"
	switch strings.TrimSpace(strings.ToLower(provider)) {
	case "github":
		username = "x-access-token"
	case "gitlab":
		username = "oauth2"
	}

	basic := base64.StdEncoding.EncodeToString([]byte(username + ":" + token))
	env["GIT_CONFIG_COUNT"] = "2"
	env["GIT_CONFIG_KEY_0"] = "http.extraHeader"
	env["GIT_CONFIG_VALUE_0"] = "Authorization: Basic " + basic
	env["GIT_CONFIG_KEY_1"] = "credential.helper"
	env["GIT_CONFIG_VALUE_1"] = ""
	return env
}

func normalizeRepoPath(value string) string {
	trimmed := strings.TrimSpace(value)
	trimmed = strings.Trim(trimmed, "/")
	return strings.TrimSuffix(trimmed, ".git")
}

func stripTrailingSlash(value string) string {
	return strings.TrimRight(strings.TrimSpace(value), "/")
}

func isRemoteURL(value string) bool {
	trimmed := strings.TrimSpace(value)
	return strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") || strings.HasPrefix(trimmed, "git@")
}

func isHTTPURL(value string) bool {
	trimmed := strings.TrimSpace(value)
	return strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://")
}

func ensureGitSuffixForURL(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if strings.HasSuffix(trimmed, ".git") {
		return trimmed
	}
	if !isHTTPURL(trimmed) {
		return trimmed + ".git"
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return trimmed + ".git"
	}
	pathValue := strings.TrimRight(parsed.Path, "/")
	if !strings.HasSuffix(pathValue, ".git") {
		pathValue += ".git"
	}
	parsed.Path = pathValue
	return parsed.String()
}

func normalizeGitHubCloneBaseURL(raw string) string {
	base := strings.TrimSpace(raw)
	if base == "" {
		base = "https://github.com"
	}
	base = stripTrailingSlash(base)
	if base == "https://api.github.com" || base == "http://api.github.com" {
		return strings.Replace(base, "api.github.com", "github.com", 1)
	}
	if strings.HasSuffix(base, "/api/v3") {
		return strings.TrimSuffix(base, "/api/v3")
	}
	return base
}

func normalizeGitLabCloneBaseURL(raw string) string {
	base := strings.TrimSpace(raw)
	if base == "" {
		base = "https://gitlab.com"
	}
	base = stripTrailingSlash(base)
	if strings.HasSuffix(base, "/api/v4") {
		return strings.TrimSuffix(base, "/api/v4")
	}
	return base
}
