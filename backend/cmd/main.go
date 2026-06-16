package main

import (
	"evalora/config"
	"evalora/internal/database"
	"evalora/internal/migration"
)

func main() {
	cfg := config.LoadConfig()
	db := database.Connect(cfg)

	migration := migration.NewMigration(db, cfg)
	if err := migration.Migrate(); err != nil {
		panic(err)
	}

}
