package utils

func IsValidPassword(password string) bool {
	if len(password) < 8 {
		return false
	}
	var hasLetter, hasDigit bool
	for _, c := range password {
		switch {
		case (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'):
			hasLetter = true
		case c >= '0' && c <= '9':
			hasDigit = true
		}
		if hasLetter && hasDigit {
			return true
		}
	}
	return false
}
