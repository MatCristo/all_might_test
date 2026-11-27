import { useContext, useState } from 'react';
import styles from './Login.module.css';
import { useNavigate } from 'react-router-dom';
import { landingPathFor } from '../../navigation/pages';
import { MeContext } from '../../context/context';
import type { Me } from '../../context/context';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { set: setSession } = useContext(MeContext);
  const apiUrl = import.meta.env.VITE_API_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });
  
      if (!response.ok) {
        setError('Email ou senha incorretos.');
        return;
      }

      /* Read this answer before anything else goes out.

         It carries the session — the pages this person holds — which is what
         decides where to land.

         Asking GET /api/me for the same thing is what broke: that request left
         while the browser was still receiving this response, so it went out
         without the cookie this response is setting, came back 401, and the
         login looked like it had to be done twice. Reading the body here is
         also what makes the cookie stored by the time we navigate. */
      const session = await response.json().catch(() => null);

      /* Hand the session over before navigating.

         The layout re-reads GET /api/me on the way out of this page, but that
         only lands after the next page has already rendered — and it renders
         against the null left behind by the /api/me that ran before anyone was
         logged in, which sends it straight back here. Signing in twice used to
         work only because the first attempt's reload had by then arrived. */
      if (Array.isArray(session?.permissions)) {
        setSession(session as Me);
      }

      setError('');
      navigate(landingPathFor(session?.permissions));
    } catch (error) {
      console.error('Error connecting to the server:', error);
      alert(error);
    } finally {
      setIsLoading(false);
    }
  };
  

  return (
    <div className={styles.loginContainer}>
      <form onSubmit={handleSubmit} className={styles.loginForm}>
        <h2>Login</h2>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.inputGroup}>
          <label>Email:</label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label>Senha:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className={styles.button} type="submit">
          {isLoading ? (
            <div className={styles.spinner}></div>
          ) : (
            'Login'
          )}
        </button>
      </form>
    </div>
  );
};

export default Login;
