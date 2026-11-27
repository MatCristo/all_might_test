/*
Package authz answers one question: which pages of the panel may this user
open?

Access is granted per page, never per endpoint. A page is also the unit the
sidebar renders, so one grant decides both what the API answers and what the
menu shows.

Roles are NOT used to authorize: the user's own rows in user_permissions are
the only thing that decides anything. The role is only a label.
*/
package authz

import (
	"sort"

	"github.com/DaviTelelaudo/all-might/internal/platform/db"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// One constant per page of the panel, matching the `permissions.name` column.
//
// Routes are annotated with these in routes/routes.go, so the whole policy is
// readable in one file.
const (
	PageIntegracao = "page:integracao"
)

// The key the actor is stored under. Echo's context is a string map, so the
//
// name is kept unexported and deliberately unlike anything a handler would
// reach for by hand.
const actorKey = "authz:actor"

// Actor is the person behind the request: who they are, and what they may
//
// open. It is resolved once by the RequireLogin middleware and read from the
// context everywhere else, so no handler has to query the user again.
type Actor struct {
	Id    uuid.UUID `json:"id"`
	Name  string    `json:"name"`
	Email string    `json:"-"`
	// The role the user was created under. A label for the screens; never
	// consulted to authorize anything.
	Role        string              `json:"role"`
	Permissions map[string]struct{} `json:"-"`
}

func (a *Actor) Can(page string) bool {
	if a == nil {
		return false
	}

	_, ok := a.Permissions[page]

	return ok
}

// PermissionNames lists the granted pages, sorted, for the API and the sidebar.
func (a *Actor) PermissionNames() []string {
	names := make([]string, 0, len(a.Permissions))

	for name := range a.Permissions {
		names = append(names, name)
	}

	sort.Strings(names)

	return names
}

func SetActor(c echo.Context, actor *Actor) {
	c.Set(actorKey, actor)
}

// ActorFrom returns the user behind the request. It reports false only when
// the route was not wrapped in RequireLogin, which is a wiring mistake rather
// than a request the caller can fix.
func ActorFrom(c echo.Context) (*Actor, bool) {
	actor, ok := c.Get(actorKey).(*Actor)

	return actor, ok && actor != nil
}

// LoadActor reads the user and their granted pages on every request, which is
//
// deliberate: an administrator who removes a page expects the next click to be
// refused, not tomorrow's login. It is two indexed reads on a table with one
// row per user per page — if that ever shows up in profiling, cache it behind a
// counter bumped on write, not behind a TTL.
func LoadActor(email string) (*Actor, error) {
	var user models.User

	err := db.DBTIApplications.Preload("Role").Where("email = ?", email).First(&user).Error

	if err != nil {
		return nil, err
	}

	var names []string

	err = db.DBTIApplications.Raw(`
		SELECT permissions.name
		FROM user_permissions
		JOIN permissions ON permissions.id = user_permissions.id_permission
		WHERE user_permissions.id_user = ?
	`, user.Id).Scan(&names).Error

	if err != nil {
		return nil, err
	}

	permissions := make(map[string]struct{}, len(names))

	for _, name := range names {
		permissions[name] = struct{}{}
	}

	return &Actor{
		Id:          user.Id,
		Name:        user.Name,
		Email:       user.Email,
		Role:        user.Role.Name,
		Permissions: permissions,
	}, nil
}
