import React, { useState, useContext } from 'react'
import styles from './resetPassword.module.css'
import { ToastContext } from '../../context/context'
import { changePassword } from './handlers/handlers'

function ResetPassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const toastContext = useContext(ToastContext)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword || !newPassword || !confirmPassword) {
      toastContext.showToast('Erro', 'Preencha todos os campos', 'danger')
      return
    }

    if (newPassword.length < 8) {
      toastContext.showToast('Erro', 'A nova senha deve ter pelo menos 8 caracteres', 'danger')
      return
    }

    if (newPassword !== confirmPassword) {
      toastContext.showToast('Erro', 'Nova senha e confirmação não conferem', 'danger')
      return
    }

    setLoading(true)
    try {
      const response = await changePassword(currentPassword, newPassword, confirmPassword)

      // data is null when the body is not JSON — a proxy's error page, say.
      if (response.success) {
        toastContext.showToast('Sucesso', response.data?.message || 'Senha alterada com sucesso!', 'success')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toastContext.showToast('Erro', response.data?.message || 'Erro ao alterar a senha', 'danger')
      }
    } catch (err) {
      console.error('Erro ao conectar com o servidor:', err)
      toastContext.showToast('Erro', 'Erro na comunicação com o servidor', 'danger')
    }
    setLoading(false)
  }

  return (
    <div className={styles.resetContainer}>
      <form onSubmit={handleSubmit} className={styles.resetForm}>
        <h2>Alterar Senha</h2>

        <div className={styles.inputGroup}>
          <label>Senha atual</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <label>Nova senha</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        <div className={styles.inputGroup}>
          <label>Confirmar senha</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? <div className={styles.spinner}></div> : 'Alterar senha'}
        </button>

      </form>
    </div>
  )
}

export default ResetPassword;