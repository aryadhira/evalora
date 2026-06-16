package handler

import "evalora/pkg/utils"

func generateOAuthState() (string, error) {
	return utils.GenerateSecureToken(16)
}
