package config

import (
	"log"

	"github.com/spf13/viper"
)

var AllowOrigin string
var CookieSecureMode bool

func Init() {
	viper.AutomaticEnv()

	AllowOrigin = viper.GetString("ALLOW_ORIGIN")
	CookieSecureMode = viper.GetBool("COOKIE_SECURE_MODE")

	if AllowOrigin == "" {
		log.Fatalf("ALLOW_ORIGIN cannot be empty")
	}
}
