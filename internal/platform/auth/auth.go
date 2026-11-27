package auth

import (
	"fmt"
	"time"

	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var TokenHashSecret string

func Init() error {
	tokenHashSecret, err := aws.GetParamFromJson("TokenHashSecret")

	if err != nil {
		return err
	}

	TokenHashSecret = *tokenHashSecret

	return nil
}

func HashPassword(data string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(data), 14)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

/*
How long a login lasts.

	The token's own `exp` and the cookie's `MaxAge` are both cut from this one
	value on purpose. If they ever disagree, the session breaks in one of two
	quiet ways: a shorter cookie makes the browser throw away a token that was
	still good, and a shorter token makes it keep sending one the API already
	refuses. TestSessionLifetime pins the two together.
*/
const SessionLifetime = 7 * 24 * time.Hour

func CreateToken(email string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256,
		jwt.MapClaims{
			"email": email,
			"exp":   time.Now().Add(SessionLifetime).Unix(),
		})

	tokenString, err := token.SignedString([]byte(TokenHashSecret))

	if err != nil {
		return "", err
	}

	return tokenString, nil
}

func VerifyTokenAndReturnUserEmail(tokenString string) (email *string, err error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(TokenHashSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, fmt.Errorf("token is not valid")
	}

	claims, ok := token.Claims.(jwt.MapClaims)

	if !ok {
		return nil, fmt.Errorf("error getting claims")
	}

	emailFromClaims, ok := claims["email"].(string)

	if !ok {
		return nil, fmt.Errorf("error email not found in token")
	}

	email = &emailFromClaims

	return email, nil
}
