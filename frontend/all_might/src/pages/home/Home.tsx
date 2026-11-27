import { useState, useEffect, useCallback, useContext } from 'react';
import styles from './Home.module.css'
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import SidebarCustom from '../../components/sidebar/sidebarCustom';
import { Modal, Button, Form, Pagination } from 'react-bootstrap';
import { ToastContext } from '../../context/context';
import InputGroupDropdown from '../../components/inputGroupDropdown/inputGroupDropdown';
import TableCustom from '../../components/table/tableCustom';
import Spinner from '../../components/spinner/spinner';
import {
  LOGS_PAGE_SIZE, fetchReportDeliveryLogs, resendReport, fetchCompanies,
} from './handlers/handlers';

type LogEntry = {
  id: number;
  company_name: string;
  service_desc: string;
  cd_atendimento: number;
  http_status_code: number;
  http_response: string;
  origin_server: string;
  created_at: string;
  report_selector_value: string;
};

type Company = {
  id: number;
  name: string;
};

function Home() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<{ [key: number]: 'idle' | 'loading' | 'success' | 'error' }>({});
  const [confirmResend, setConfirmResend] = useState<LogEntry | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchCdAtendimento, setSearchAtendimento] = useState<string>('');
  const [actualSearchCdAtendimento, setActualSearchCdAtendimento] = useState<string>('');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<boolean | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  /* Mirrors selectedCompany, but only once "Buscar" has run — so the table and
     the pagination always describe the same query. */
  const [appliedCompanyId, setAppliedCompanyId] = useState<string>('');
  const toastContext = useContext(ToastContext);

  const navigate = useNavigate();

  /* Every request on this page treats an expired session the same way, and
     403 / other failures all end in the same toast. */
  const handleFailure = useCallback((
    status: number,
    data: { message?: string } | null,
    context: string
  ) => {
    if (status === 401) {
      navigate('/login');
      return;
    }
    if (status === 403) {
      toastContext.showToast("Erro", "Usuário sem permissão", "danger");
      return;
    }
    toastContext.showToast("Erro", `${context}: ${data?.message || 'Erro desconhecido'}`, "danger");
  }, [navigate, toastContext]);

  const handleStatusClick = (response: string) => {
    setSelectedResponse(response);
  };

  const closeResponseModal = () => {
    setSelectedResponse(null);
  };

  const closeResendModal = () => {
    setConfirmResend(null);
    setResendMessage(null);
  };

  const handleResend = async (log: LogEntry): Promise<string> => {
    setResendStatus(prev => ({ ...prev, [log.id]: 'loading' }));
    setResendSuccess(null);

    try {
      const { success, status, data } = await resendReport(log.cd_atendimento);

      if (status === 401) {
        navigate('/login');
        setResendSuccess(false);
        return 'Sessão expirada. Redirecionando para login.';
      }

      if (!success) {
        setResendStatus(prev => ({ ...prev, [log.id]: 'error' }));
        setResendSuccess(false);
        return 'Erro tentando reenviar laudo: ' + (data?.message || 'Falha ao reenviar o laudo');
      }

      setResendStatus(prev => ({ ...prev, [log.id]: 'success' }));
      setResendSuccess(true);
      return data?.message || 'Reenvio realizado com sucesso!';
    } catch (error) {
      setResendStatus(prev => ({ ...prev, [log.id]: 'error' }));
      setResendSuccess(false);
      const reason = error instanceof Error ? error.message : 'Erro desconhecido';
      return 'Erro tentando reenviar laudo: ' + reason;
    } finally {
      /* The row keeps its outcome for a while so an operator who looks away
         can still see what happened, then returns to idle. */
      setTimeout(() => {
        setResendStatus(prev => ({ ...prev, [log.id]: 'idle' }));
      }, 30000);
    }
  };

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setLogs([]);

      const { success, status, data } = await fetchReportDeliveryLogs(
        currentPage,
        actualSearchCdAtendimento,
        appliedCompanyId
      );

      if (!success) return handleFailure(status, data, "Erro obtendo os logs");

      setLogs(data ?? []);
    } catch (error) {
      toastContext.showToast("Erro", "Erro obtendo os logs: " + (error || 'Erro desconhecido'), "danger");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, actualSearchCdAtendimento, appliedCompanyId, handleFailure, toastContext]);

  const loadCompanies = useCallback(async () => {
    try {
      const { success, status, data } = await fetchCompanies();

      if (!success) return handleFailure(status, data, "Erro obtendo as empresas");

      setCompanies((data as Company[]) ?? []);
    } catch (error) {
      toastContext.showToast("Erro", "Erro obtendo as empresas: " + (error || 'Erro desconhecido'), "danger");
    }
  }, [handleFailure, toastContext]);

  useEffect(() => {
    loadLogs();
  }, [currentPage, actualSearchCdAtendimento, appliedCompanyId]);

  useEffect(() => {
    loadCompanies();
  }, []);

  /* Both filters are applied together, and always from page 0 — page 3 of the
     old result set says nothing about the new one. */
  const handleSearch = () => {
    setCurrentPage(0);
    setActualSearchCdAtendimento(searchCdAtendimento);
    setAppliedCompanyId(selectedCompany ? String(selectedCompany.id) : '');
  }

  const handleClearFilters = () => {
    setCurrentPage(0);
    setSearchAtendimento('');
    setActualSearchCdAtendimento('');
    setSelectedCompany(null);
    setAppliedCompanyId('');
  }

  const hasActiveFilters = actualSearchCdAtendimento !== '' || appliedCompanyId !== '';

  /* The endpoint returns a bare array with no total, so the only signal that
     more rows exist is a page that came back completely full. */
  const hasNextPage = logs.length === LOGS_PAGE_SIZE;

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'Success';
    if (statusCode >= 400 && statusCode < 500) return 'Warning';
    if (statusCode >= 500) return 'Error';
    return 'Info';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    date.setTime(date.getTime() + 3 * 60 * 60 * 1000);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false 
    });
  };

  function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  return (
  <div className={styles.appContainer}>
    <SidebarCustom/>
    <div className={styles.contentContainer}>
      <h1 className={styles.pageTitle}>Logs de entrega de laudos</h1>

      <div className={styles.filterRow}>
        <Form.Control
          placeholder="Buscar por código de atendimento..."
          aria-label="Buscar por código de atendimento"
          className={styles.searchField}
          value={searchCdAtendimento}
          onChange={(e) => setSearchAtendimento(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
        />
        <div className={styles.companyField}>
          <InputGroupDropdown
            data={companies}
            title="Empresa"
            minWidth={90}
            value={selectedCompany?.name || 'Todas'}
            onClickOne={(company) => setSelectedCompany(company as Company | null)}
          />
        </div>
        <Button variant="primary" onClick={handleSearch} disabled={isLoading}>
          Buscar
        </Button>
        {hasActiveFilters && (
          <Button variant="outline-secondary" onClick={handleClearFilters} disabled={isLoading}>
            Limpar
          </Button>
        )}
      </div>

      <TableCustom>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Serviço</th>
              <th>Código de atendimento</th>
              <th>Status</th>
              <th>Servidor</th>
              <th>Empresa</th>
              <th>Reenviar</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className={styles.loadingCell}>
                  <Spinner label="Carregando logs" />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.noDataCell}>
                  {hasActiveFilters
                    ? 'Nenhum log corresponde aos filtros.'
                    : 'Nenhum log encontrado.'}
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.created_at)}</td>
                  <td>{log.service_desc}</td>
                  <td>{log.cd_atendimento}</td>
                  <td>
                    <button
                      type="button"
                      className={clsx(
                        styles.statusTag,
                        styles[`status${capitalize(getStatusColor(log.http_status_code))}`],
                        styles.clickable
                      )}
                      title="Ver resposta HTTP"
                      onClick={() => handleStatusClick(log.http_response)}
                    >
                      {log.http_status_code}
                    </button>
                  </td>
                  <td>{log.origin_server}</td>
                  <td>{log.company_name}</td>
                  <td>
                    <button
                      className={clsx(
                        styles.resendButton,
                        resendStatus[log.id]
                          ? styles[`resendButton${capitalize(resendStatus[log.id])}`]
                          : styles.resendButtonIdle
                      )}
                      onClick={() => setConfirmResend(log)}
                      disabled={resendStatus[log.id] === 'loading'}
                    >
                      {resendStatus[log.id] === 'loading' ? 'Enviando...' : 
                      resendStatus[log.id] === 'success' ? 'Sucesso!' :
                      resendStatus[log.id] === 'error' ? 'Erro' : 'Reenviar'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCustom>

      {!isLoading && (
        <div className="d-flex flex-column align-items-center mt-4">
          <Pagination>
            {/* No First/Last: the API returns no total, so there is no last page
                to jump to, and a lone « would be lopsided. */}
            <Pagination.Prev
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))}
              disabled={currentPage === 0}
            />
            <Pagination.Item active>{currentPage + 1}</Pagination.Item>
            <Pagination.Next
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={!hasNextPage}
            />
          </Pagination>
          <small className="text-center text-muted">
            Exibindo {logs.length} {logs.length === 1 ? 'log' : 'logs'} · página {currentPage + 1}
          </small>
        </div>
      )}
    </div>

    {/* ---------- HTTP response detail ---------- */}
    <Modal show={selectedResponse !== null} onHide={closeResponseModal} centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title className={styles.modalTitle}>Detalhes da resposta HTTP</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <pre className={styles.responseContent}>{selectedResponse}</pre>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={closeResponseModal}>Fechar</Button>
      </Modal.Footer>
    </Modal>

    {/* ---------- resend confirmation / outcome ---------- */}
    <Modal show={confirmResend !== null} onHide={closeResendModal} centered>
      <Modal.Header closeButton>
        <Modal.Title className={styles.modalTitle}>
          {resendMessage ? 'Resultado do reenvio' : 'Confirmar reenvio'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!resendMessage ? (
          <p className="mb-0">
            Deseja reenviar o exame com código de atendimento{' '}
            <strong>{confirmResend?.cd_atendimento}</strong>?
          </p>
        ) : (
          <p className="mb-0">
            {resendSuccess === true && <span className={styles.successIcon}>✔</span>}
            {resendSuccess === false && <span className={styles.errorIcon}>✖</span>}
            {resendMessage}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        {!resendMessage ? (
          <>
            <Button variant="secondary" onClick={closeResendModal}>Cancelar</Button>
            <Button
              variant="primary"
              disabled={confirmResend ? resendStatus[confirmResend.id] === 'loading' : false}
              onClick={async () => {
                if (!confirmResend) return;
                const message = await handleResend(confirmResend);
                setResendMessage(message);
              }}
            >
              {confirmResend && resendStatus[confirmResend.id] === 'loading'
                ? <Spinner size={16} tone="onAccent" label="Reenviando" />
                : 'Reenviar'}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={closeResendModal}>Fechar</Button>
        )}
      </Modal.Footer>
    </Modal>

  </div>      
  );
}

export default Home;
