package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	AppPort            string
	DBHost             string
	DBPort             string
	DBUser             string
	DBPassword         string
	DBName             string
	RedisHost          string
	RedisPort          string
	RedisPassword      string
	AppSecret          string
	MaxIdleConnections int
	MaxOpenConnections int
	AutoMigrate        bool
}

func LoadConfig() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}

	maxIdle, err := strconv.Atoi(os.Getenv("MAX_IDLE_CONNECTIONS"))
	if err != nil {
		log.Fatalf("Invalid MAX_IDLE_CONNECTIONS value: %v", err)
	}

	maxOpen, err := strconv.Atoi(os.Getenv("MAX_OPEN_CONNECTIONS"))
	if err != nil {
		log.Fatalf("Invalid MAX_OPEN_CONNECTIONS value: %v", err)
	}

	return &Config{
		AppPort:            os.Getenv("APP_PORT"),
		DBHost:             os.Getenv("DB_HOST"),
		DBPort:             os.Getenv("DB_PORT"),
		DBUser:             os.Getenv("DB_USER"),
		DBPassword:         os.Getenv("DB_PASSWORD"),
		DBName:             os.Getenv("DB_NAME"),
		RedisHost:          os.Getenv("REDIS_HOST"),
		RedisPort:          os.Getenv("REDIS_PORT"),
		RedisPassword:      os.Getenv("REDIS_PASSWORD"),
		AppSecret:          os.Getenv("APP_SECRET"),
		MaxIdleConnections: maxIdle,
		MaxOpenConnections: maxOpen,
		AutoMigrate:        os.Getenv("AUTO_MIGRATE") == "true",
	}
}
