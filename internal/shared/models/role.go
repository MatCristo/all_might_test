package models

import "github.com/google/uuid"

type Role struct {
	Id   uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	Name string    `gorm:"column:name" json:"-"`
}
