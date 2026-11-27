import { useContext } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { MeContext } from '../../context/context';
import SidebarCustom from '../sidebar/sidebarCustom';
import Spinner from '../spinner/spinner';
import styles from './pageGuard.module.css';

/* Wraps a page in the permission it needs.

   This is not the security boundary — the API refuses on its own, and anything
   React decides can be edited by whoever is looking at it. It exists so that a
   page someone cannot use says so, instead of loading and then filling with
   failed requests. */
export default function PageGuard({ permission, children }: { permission: string; children: ReactNode }) {
    const { me, isLoading, can } = useContext(MeContext);

    /* Only blank the page when there is nothing to show yet. A reload of a
       session we already hold is a background check, and blanking on it would
       flash a spinner over a page that is perfectly usable. */
    if (isLoading && !me) {
        return (
            <div className={styles.page}>
                <div className={styles.center}>
                    <Spinner label="Carregando" />
                </div>
            </div>
        );
    }

    /* No session at all: the pages send people to /login on a 401 of their own,
       so this only catches the cookie expiring between two navigations. */
    if (!me) {
        return <Navigate to="/login" replace />;
    }

    if (!can(permission)) {
        return (
            <div className={styles.page}>
                <SidebarCustom />
                <div className={styles.center}>
                    <div className={styles.card}>
                        <h1 className={styles.title}>Sem acesso a esta página</h1>
                        <p className={styles.text}>
                            Sua conta não tem permissão para <strong>{permission}</strong>. Peça a alguém que
                            administra permissões para liberar o acesso.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
