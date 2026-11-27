package db

import "gorm.io/gorm"

var txClinux *gorm.DB
var txTIApplications *gorm.DB

func TestInitTransaction() {
	txClinux = DBClinux.Begin()
	txTIApplications = DBTIApplications.Begin()

	DBClinux = txClinux
	DBTIApplications = txTIApplications
}

func TestRollback() {
	txClinux.Rollback()
	txTIApplications.Rollback()
}
