package oidc

import (
	"context"
	"fmt"
	"os"

	gooidc "github.com/coreos/go-oidc/v3/oidc"
)

var (
	Verifier *gooidc.IDTokenVerifier
	Provider *gooidc.Provider
)

// Claims represents the user claims extracted from the OIDC token.
type Claims struct {
	Sub               string `json:"sub"`
	Email             string `json:"email"`
	Name              string `json:"name"`
	PreferredUsername string `json:"preferred_username"`
	GivenName         string `json:"given_name"`
	FamilyName        string `json:"family_name"`
}

// Init sets up the OIDC provider and verifier using Keycloak discovery.
// In Docker, Keycloak is reachable at two URLs: the internal container name
// (e.g. http://keycloak:8080) and the browser-facing host (e.g. http://localhost:8080).
// Tokens carry the browser-facing issuer, so we fetch OIDC discovery from the
// internal URL but validate the issuer claim against the public URL.
func Init() error {
	keycloakURL := os.Getenv("KEYCLOAK_URL")      // internal: http://keycloak:8080
	publicURL := os.Getenv("KEYCLOAK_PUBLIC_URL") // browser-facing: http://localhost:8080
	realm := os.Getenv("KEYCLOAK_REALM")
	clientID := os.Getenv("KEYCLOAK_CLIENT_ID")

	internalIssuer := fmt.Sprintf("%s/realms/%s", keycloakURL, realm)

	if publicURL == "" {
		publicURL = keycloakURL
	}
	publicIssuer := fmt.Sprintf("%s/realms/%s", publicURL, realm)

	// NewProvider's issuer arg is used for discovery (must be internal/reachable).
	// InsecureIssuerURLContext overrides the issuer used for token validation (public/browser-facing).
	ctx := gooidc.InsecureIssuerURLContext(context.Background(), publicIssuer)
	var err error
	Provider, err = gooidc.NewProvider(ctx, internalIssuer)
	if err != nil {
		return fmt.Errorf("failed to create OIDC provider: %w", err)
	}

	Verifier = Provider.Verifier(&gooidc.Config{
		ClientID:          clientID,
		SkipClientIDCheck: true, // Keycloak access tokens use "account" as audience, not client ID
	})

	return nil
}
