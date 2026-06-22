package router

import (
	"evalora/config"
	"evalora/internal/handler"
	"evalora/internal/middleware"

	"github.com/gofiber/fiber/v3"
)

func Setup(app *fiber.App, authHandler *handler.AuthHandler, cfg *config.Config) {
	jwtAuth := middleware.JWTAuth(cfg)
	auth := app.Group("/auth")

	// Public
	auth.Post("/register", authHandler.Register)
	auth.Post("/verify-email", authHandler.VerifyEmail)
	auth.Post("/resend-verification", authHandler.ResendVerification)
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/forgot-password", authHandler.ForgotPassword)
	auth.Post("/reset-password", authHandler.ResetPassword)

	// Google OAuth
	auth.Get("/google", authHandler.GoogleOAuth)
	auth.Get("/google/callback", authHandler.GoogleOAuthCallback)

	// 2FA (challenge is semi-public — uses pending token, not JWT)
	auth.Post("/2fa/challenge", authHandler.TOTPChallenge)

	// Protected
	auth.Post("/logout", jwtAuth, authHandler.Logout)
	auth.Get("/2fa/status", jwtAuth, authHandler.TOTPStatus)
	auth.Get("/2fa/setup", jwtAuth, authHandler.TOTPSetup)
	auth.Post("/2fa/enable", jwtAuth, authHandler.TOTPEnable)
	auth.Post("/2fa/disable", jwtAuth, authHandler.TOTPDisable)
	auth.Post("/2fa/backup/regenerate", jwtAuth, authHandler.TOTPRegenerateBackup)
	auth.Get("/sessions", jwtAuth, authHandler.ListSessions)
	auth.Delete("/sessions", jwtAuth, authHandler.RevokeAllSessions)
	auth.Delete("/sessions/:session_id", jwtAuth, authHandler.RevokeSession)
	auth.Get("/me", jwtAuth, authHandler.GetMe)
	auth.Patch("/me", jwtAuth, authHandler.UpdateMe)
}
