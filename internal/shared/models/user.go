package models

import "github.com/google/uuid"

type User struct {
	Id       uuid.UUID `gorm:"column:id;primaryKey;type:uuid;default:uuid_generate_v4()" json:"id"`
	Name     string    `gorm:"column:name" json:"name"`
	Email    string    `gorm:"column:email" json:"-"`
	Password string    `gorm:"column:password" json:"-"`
	IdRole   uuid.UUID `gorm:"column:id_role;type:uuid;notnull" json:"-"`
	Role     Role      `gorm:"foreignKey:IdRole" json:"-"`
}

/*
Who the caller is and what they may open.

	Answered by GET /api/me and by POST /api/login alike: login returns the
	session it has just created, so the page that signs somebody in does not
	have to ask for it in a second request — one that would go out before the
	browser had finished storing the cookie the login response is still
	delivering, and come back 401.
*/
type SessionDTO struct {
	Id   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	// The role the user was created under. A label; it grants nothing.
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
	// Only login says anything; /api/me leaves it out.
	Message string `json:"message,omitempty"`
}
