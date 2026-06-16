package main

import (
	"evalora/config"
	"evalora/internal/database"
	"evalora/internal/handler"
	"evalora/internal/migration"
	"evalora/internal/repository"
	"evalora/internal/router"
	"evalora/internal/service"
	"log"

	"github.com/gofiber/fiber/v3"
)

func main() {
	cfg := config.LoadConfig()
	db := database.Connect(cfg)

	m := migration.NewMigration(db, cfg)
	if err := m.Migrate(); err != nil {
		panic(err)
	}

	// Repositories
	userRepo := repository.NewUserRepository(db)
	authRepo := repository.NewAuthRepository(db)

	// Services
	emailSvc := service.NewEmailService(cfg)
	authSvc := service.NewAuthService(userRepo, authRepo, emailSvc, cfg)

	// Handlers
	authHandler := handler.NewAuthHandler(authSvc)

	// App
	app := fiber.New()
	router.Setup(app, authHandler, cfg)

	log.Printf("Server starting on port %s", cfg.AppPort)
	if err := app.Listen(":" + cfg.AppPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
