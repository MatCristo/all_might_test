import { useState, useContext, useEffect } from 'react';
import { Sidebar, Menu, MenuItem } from 'react-pro-sidebar';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import styles from './sidebarCustom.module.css';
import { DarkModeContext, MeContext } from '../../context/context';
import { PANEL_PAGES } from '../../navigation/pages';
import { logout } from '../../handlers/handlers';

const COLLAPSE_KEY = 'sidebarCollapsed';

/* One list drives the rendering, the current-page match and the permission the
   entry needs, so a new screen cannot be added to the nav without also getting
   an active state and a rule about who sees it.

   The permission is the same one the API demands of the routes behind the page:
   showing a menu entry that only leads to a 403 is worse than hiding it. The
   entries live in navigation/pages. */

const SidebarCustom = () => {
  const { isDark, toggleDark } = useContext(DarkModeContext);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  /* Operators keep the rail the way they left it between sessions. */
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(COLLAPSE_KEY) === 'true'
  );

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, String(collapsed));
  }, [collapsed]);

  const { can, clear } = useContext(MeContext);

  /* `jwt` is HttpOnly: the browser cannot delete it, so signing out has to ask
     the server to expire it. Until it does, pressing Back walks straight back
     into the session — on a shared machine, into someone else's.

     The context is cleared either way: if the request fails the person still
     leaves, and the menu must not be the one they had. */
  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clear();
      navigate('/login');
    }
  };
  const visibleItems = PANEL_PAGES.filter(item => can(item.permission));

  /* `/` would otherwise prefix-match every route, so it has to be exact. */
  const isCurrent = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path;

  const width = collapsed ? '0px' : 'var(--nav-w)';

  return (
    <>
      <div className={styles.spacer} style={{ width }} />

      {/* With the rail hidden there is nothing left to click, so the control
          steps outside it. */}
      {collapsed && (
        <button
          type="button"
          className={styles.floatingToggle}
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          title="Abrir menu"
          aria-label="Abrir menu"
        >
          <FiChevronRight size={18} />
        </button>
      )}

      <nav
        aria-label="Menu principal"
        className={styles.wrapper}
        style={{ width }}
        /* Nothing inside is reachable by keyboard or screen reader while the
           rail is closed. */
        inert={collapsed ? true : undefined}
      >
        <Sidebar width="var(--nav-w)" rootStyles={{ height: '100%', border: 'none' }}>
          <div className={styles.brand}>
            <span className={styles.brandText}>
              <span className={styles.brandName}>Telelaudo</span>
              <span className={styles.brandSub}>Painel interno</span>
            </span>
            <button
              type="button"
              className={styles.toggle}
              onClick={() => setCollapsed(true)}
              aria-expanded
              title="Recolher menu"
              aria-label="Recolher menu"
            >
              <FiChevronLeft size={18} />
            </button>
          </div>

          <Menu
            /* Colours go through the library's own styling API rather than CSS:
               react-pro-sidebar injects its defaults with emotion at runtime, at
               the same specificity as a module rule, so a stylesheet loses the
               order fight. This API also hands us `active`. */
            menuItemStyles={{
              button: ({ active }) => ({
                height: 'auto',
                padding: '0.625rem 0.75rem',
                margin: '2px 0',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--fs-base)',
                fontWeight: active ? 650 : 500,
                color: active ? 'var(--nav-ink)' : 'var(--nav-ink-dim)',
                backgroundColor: active ? 'var(--nav-active-bg)' : 'transparent',
                transition:
                  'background-color var(--dur-1) var(--ease-out), color var(--dur-1) var(--ease-out)',
                '&:hover': {
                  backgroundColor: active
                    ? 'var(--nav-active-bg)'
                    : 'var(--nav-hover-bg)',
                  color: 'var(--nav-ink)',
                },
                '&:focus-visible': {
                  outline: '2px solid var(--nav-ink)',
                  outlineOffset: '-2px',
                },
              }),
              label: { whiteSpace: 'nowrap' },
            }}
          >
            {visibleItems.map(item => (
              <MenuItem
                key={item.path}
                active={isCurrent(item.path)}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </MenuItem>
            ))}
          </Menu>

          {/* Preference and session actions: controls, not destinations, so
              they sit below the rule rather than joining the menu above it. */}
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.footerButton}
              onClick={toggleDark}
              title={isDark ? 'Usar tema claro' : 'Usar tema escuro'}
            >
              {isDark ? 'Tema claro' : 'Tema escuro'}
            </button>
            <button
              type="button"
              className={styles.footerButton}
              onClick={() => navigate('/reset-password')}
              title="Alterar senha"
            >
              Alterar senha
            </button>
            <button
              type="button"
              className={styles.footerButton}
              onClick={handleLogout}
              title="Sair do sistema"
            >
              Sair
            </button>
          </div>
        </Sidebar>
      </nav>
    </>
  );
};

export default SidebarCustom;
