package main

import (
	"log"
	"net/http"

	"github.com/DaviTelelaudo/all-might/internal/platform/auth"
	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/DaviTelelaudo/all-might/internal/platform/config"
	"github.com/DaviTelelaudo/all-might/internal/platform/db"
	"github.com/DaviTelelaudo/all-might/routes"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {

	config.Init()

	err := aws.Init()

	if err != nil {
		log.Fatalf("Error initing package aws: %v", err)
	}

	err = db.Init()

	if err != nil {
		log.Fatalf("Error connecting database: %v", err)
	}

	err = auth.Init()

	if err != nil {
		log.Fatalf("Error initing package authorization: %v", err)
	}

	e := echo.New()

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{config.AllowOrigin},
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodDelete, http.MethodPut},
		AllowHeaders:     []string{"Content-Type"},
		AllowCredentials: true,
	}))

	err = routes.Init(e)

	if err != nil {
		log.Fatalf("Error starting routes: %v", err)
	}

	go aws.RegisterLog("ApplicationStarted", "Application started successfully")

	e.Logger.Fatal(e.Start("0.0.0.0:1323"))

}
