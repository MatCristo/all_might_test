package userstore

import (
	"github.com/DaviTelelaudo/all-might/internal/platform/db"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
)

func UpdateUserPassword(email, hashPassword string) error {
	err := db.DBTIApplications.Model(&models.User{}).
		Where("email = ?", email).
		Update("password", hashPassword).
		Error

	return err
}

func GetUserByEmail(email string) (*models.User, error) {
	user := models.User{Email: email}

	err := db.DBTIApplications.Preload("Role").Where("email = ?", user.Email).First(&user).Error

	if err != nil {
		return nil, err
	}

	return &user, nil
}
