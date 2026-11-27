package user

import (
	"net/http"
	"time"

	"github.com/DaviTelelaudo/all-might/internal/domain/user/userstore"
	"github.com/DaviTelelaudo/all-might/internal/platform/auth"
	"github.com/DaviTelelaudo/all-might/internal/platform/authz"
	"github.com/DaviTelelaudo/all-might/internal/platform/config"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
	"github.com/DaviTelelaudo/all-might/internal/shared/utils"
	"github.com/labstack/echo/v4"
)

func Login(c echo.Context) error {
	type UserDTO struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var userDTO UserDTO

	err := c.Bind(&userDTO)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.MessageDTO{Message: "Bad request"})
	}
	user, err := userstore.GetUserByEmail(userDTO.Email)

	if err != nil {
		return c.JSON(http.StatusBadRequest, models.MessageDTO{Message: "Not found a user with that email."})
	}

	check := auth.CheckPasswordHash(userDTO.Password, user.Password)

	if !check {
		return c.JSON(http.StatusBadRequest, models.MessageDTO{Message: "Wrong Password."})
	}

	tokenString, err := auth.CreateToken(user.Email)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.MessageDTO{Message: "Error creating the token."})
	}

	cookie := new(http.Cookie)
	cookie.Name = "jwt"
	cookie.Value = tokenString
	cookie.Path = "/"
	cookie.HttpOnly = true
	cookie.Secure = config.CookieSecureMode
	cookie.SameSite = http.SameSiteStrictMode
	// The same lifetime the token carries, so the two expire together.
	cookie.MaxAge = int(auth.SessionLifetime.Seconds())

	c.SetCookie(cookie)

	/* The answer carries the session it just created.

	   The login page needs the granted pages to know where to send someone,
	   and asking for them in a second request meant firing that request while
	   the browser was still receiving — and had not yet stored — the cookie
	   this response is setting. It arrived with no cookie on it, answered 401,
	   and made a login that had in fact worked look like it had not. */
	actor, err := authz.LoadActor(user.Email)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.MessageDTO{Message: "Error reading the session."})
	}

	return c.JSON(http.StatusOK, models.SessionDTO{
		Message:     "Login successful",
		Id:          actor.Id,
		Name:        actor.Name,
		Role:        actor.Role,
		Permissions: actor.PermissionNames(),
	})
}

// Logout ends the session by expiring the cookie that carries it.
//
// The browser cannot do this for itself: `jwt` is HttpOnly, which is exactly
// the point of it, so `document.cookie = 'jwt='` in the frontend clears
// nothing and the next request arrives signed in as whoever just left. On a
// shared machine that is the whole difference between signing out and closing
// a tab.
//
// The attributes below must mirror Login's, or the browser treats it as a
// different cookie and leaves the live one in place.
func Logout(c echo.Context) error {
	cookie := new(http.Cookie)
	cookie.Name = "jwt"
	cookie.Value = ""
	cookie.Path = "/"
	cookie.HttpOnly = true
	cookie.Secure = config.CookieSecureMode
	cookie.SameSite = http.SameSiteStrictMode
	// Expired both ways: MaxAge for everything current, Expires for the older
	// browsers that ignore it.
	cookie.MaxAge = -1
	cookie.Expires = time.Unix(0, 0)

	c.SetCookie(cookie)

	return c.JSON(http.StatusOK, models.MessageDTO{Message: "Logout successful"})
}

func ResetPassword(c echo.Context) error {
	type ResetPasswordDTO struct {
		Password    string `json:"password"`
		NewPassword string `json:"newPassword"`
	}

	var resetPasswordDTO ResetPasswordDTO

	if err := c.Bind(&resetPasswordDTO); err != nil {
		return c.JSON(http.StatusBadRequest, models.MessageDTO{Message: "Requisição inválida"})
	}

	userEmail := c.Get("userEmail").(string)

	user, err := userstore.GetUserByEmail(userEmail)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.MessageDTO{Message: "Usuário não encontrado"})
	}

	check := auth.CheckPasswordHash(resetPasswordDTO.Password, user.Password)
	if !check {
		return c.JSON(http.StatusBadRequest, models.MessageDTO{Message: "Senha atual incorreta"})
	}

	if !utils.IsValidPassword(resetPasswordDTO.NewPassword) {
		return c.JSON(http.StatusBadRequest, models.MessageDTO{Message: "A nova senha deve ter pelo menos 8 caracteres e conter letras e números"})
	}

	newPasswordHash, err := auth.HashPassword(resetPasswordDTO.NewPassword)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.MessageDTO{Message: "Erro ao processar a nova senha"})
	}

	err = userstore.UpdateUserPassword(userEmail, newPasswordHash)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.MessageDTO{Message: "Erro ao atualizar a senha"})
	}

	return c.JSON(http.StatusOK, models.MessageDTO{Message: "Senha alterada com sucesso!"})
}
