import { useContext } from 'react';
import { ToastContext, DarkModeContext } from '../../context/context';
import Toast from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';

function ToastCustom() {
    const toastContext = useContext(ToastContext);
    const { isDark } = useContext(DarkModeContext);

    return (
        <ToastContainer style={{zIndex: 99999, paddingBottom: 20, paddingRight: 20}} position='bottom-end'>
            <Toast
                bg={toastContext.variant.toLowerCase()}
                show={toastContext.isVisible}
                onClose={() => toastContext.closeToast()}
                data-bs-theme={isDark ? 'dark' : 'light'}
            >
                <Toast.Header>
                    <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                    <strong className="me-auto">{toastContext.title}</strong>
                </Toast.Header>
                <Toast.Body className={isDark ? 'text-white' : ''}>
                    {toastContext.message}
                </Toast.Body>
            </Toast>
        </ToastContainer>
    );
}

export default ToastCustom;