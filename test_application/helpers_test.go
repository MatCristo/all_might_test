package test

import (
	"testing"

	"github.com/DaviTelelaudo/all-might/internal/platform/authz"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
)

// setActingUser puts a user in the context the way RequireLogin does, for the
// tests that call handlers directly instead of going through the route table.
// It resolves the real user, so a handler that reads the actor sees exactly
// what it would see in production.
func setActingUser(t *testing.T, c echo.Context, email string) {
	t.Helper()

	actor, err := authz.LoadActor(email)
	require.NoError(t, err)

	authz.SetActor(c, actor)
	c.Set("userEmail", email)
}
