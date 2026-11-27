package db

import (
	"fmt"

	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DBClinux *gorm.DB
var DBTIApplications *gorm.DB

func Init() error {
	dbParams, err := aws.GetParamsFromJson([]string{
		rdsClinuxDBParameter,
		rdsClinuxHostParameter,
		rdsClinuxUserParameter,
		rdsClinuxPasswordParameter,
		rdsTIApplicationsDBParameter,
		rdsTIApplicationsHostParameter,
		rdsTIApplicationsUserParameter,
		rdsTIApplicationsPasswordParameter,
	})

	if err != nil {
		return err
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s",
		dbParams[rdsClinuxHostParameter], dbParams[rdsClinuxUserParameter],
		dbParams[rdsClinuxPasswordParameter], dbParams[rdsClinuxDBParameter], "5432")

	DBClinux, err = gorm.Open(postgres.Open(dsn))

	if err != nil {
		return err
	}

	dsn = fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s",
		dbParams[rdsTIApplicationsHostParameter], dbParams[rdsTIApplicationsUserParameter],
		dbParams[rdsTIApplicationsPasswordParameter], dbParams[rdsTIApplicationsDBParameter], "5432")

	DBTIApplications, err = gorm.Open(postgres.Open(dsn))

	return err
}
