import styles from './tableCustom.module.css'
import type { ReactNode } from 'react';

interface TableCustomProps {
    children: ReactNode;
}

export default function TableCustom({ children }: TableCustomProps) {
    return (
    <div className={styles.dataContainer}>
        <div className={styles.dataTable}>
            {children}
        </div>
    </div>
    )
}