/**
 * Transfer jobs - creation wizard and history
 */

import { useState, useEffect } from 'react';
import { connectionsAPI, discoveryAPI, transfersAPI } from '../api/client';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usePolling } from '../hooks/usePolling';
import Modal from '../components/Modal';
import { TabList } from '../components/Tabs';
import {
  HiOutlinePlus,
  HiOutlinePlay,
  HiOutlineStop,
  HiOutlineEye,
  HiOutlineArrowRight,
  HiOutlineSwitchHorizontal,
} from 'react-icons/hi';

const formatRows = (n) => (n === null || n === undefined ? '?' : new Intl.NumberFormat().format(n));

function Transfers() {
  const [transfers, setTransfers] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [wizardErrors, setWizardErrors] = useState([]);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const newParam = searchParams.get('new');
  const statusFilter = searchParams.get('status') || 'all';
  const sourceTableState = location.state?.sourceTable;

  // Wizard form state
  const [wizardForm, setWizardForm] = useState({
    source_connection_id: '',
    source_schema: '',
    source_table: '',
    target_connection_id: '',
    target_schema: '',
    target_table: '',
    filter_query: '',
    create_target_table: true,
  });
  const [sourceSchemas, setSourceSchemas] = useState([]);
  const [sourceTables, setSourceTables] = useState([]);
  const [targetSchemas, setTargetSchemas] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);

  // Column mapping state: { include: {col: bool}, rename: {col: string} }
  const [sourceColumns, setSourceColumns] = useState([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [columnSelection, setColumnSelection] = useState({
    include: {},
    rename: {},
  });

  useEffect(() => {
    loadData();
    if (sourceTableState) {
      setWizardForm((prev) => ({
        ...prev,
        source_connection_id: sourceTableState.connId,
        source_schema: sourceTableState.schema,
        source_table: sourceTableState.tableName,
      }));
      setShowWizard(true);
      setWizardStep(2);
    } else if (newParam === '1') {
      // Deep link from the Dashboard's primary action.
      setShowWizard(true);
      setWizardStep(1);
    }
    // Deep-link prefill only needs to run when navigation state / query changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceTableState, newParam]);

  // Poll for running transfers, honouring the URL filter.
  const hasRunning = transfers.some((t) => t.status === 'running' || t.status === 'pending');
  usePolling(
    async (signal) => {
      const params = statusFilter !== 'all' ? { status: statusFilter } : undefined;
      const res = await transfersAPI.list(params, signal);
      setTransfers(res.data);
    },
    5000,
    hasRunning,
  );

  const loadData = async () => {
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : undefined;
      const [txRes, connRes] = await Promise.all([
        transfersAPI.list(params),
        connectionsAPI.list(),
      ]);
      setTransfers(txRes.data);
      setConnections(connRes.data);
    } catch {
      toast.error('Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  const loadSchemas = async (connId, setter) => {
    if (!connId) return;
    try {
      const res = await discoveryAPI.getSchemas(connId);
      setter(res.data);
    } catch {
      toast.error('Failed to load schemas');
    }
  };

  const loadTables = async (connId, schema, setter) => {
    if (!connId) return;
    setTablesLoading(true);
    try {
      const res = await discoveryAPI.getTables(connId, schema || undefined);
      setter(res.data);
    } catch {
      toast.error('Failed to load tables');
      setter([]);
    } finally {
      setTablesLoading(false);
    }
  };

  const loadColumns = async () => {
    if (!wizardForm.source_connection_id || !wizardForm.source_table) return;
    setColumnsLoading(true);
    try {
      const res = await discoveryAPI.getColumns(
        wizardForm.source_connection_id,
        wizardForm.source_table,
        wizardForm.source_schema || undefined,
      );
      setSourceColumns(res.data);
      setColumnSelection({
        include: Object.fromEntries(res.data.map((c) => [c.name, true])),
        rename: {},
      });
    } catch {
      toast.error('Failed to load columns');
      setSourceColumns([]);
    } finally {
      setColumnsLoading(false);
    }
  };

  const buildColumnMappings = () => {
    const included = sourceColumns.filter((c) => columnSelection.include[c.name]);
    if (included.length === sourceColumns.length) {
      const renamed = included.filter((c) => columnSelection.rename[c.name]);
      if (renamed.length === 0) return null; // transfer everything as-is
    }
    return Object.fromEntries(
      included.map((c) => [c.name, columnSelection.rename[c.name]?.trim() || c.name]),
    );
  };

  const handleCreateTransfer = async () => {
    setWizardErrors([]);
    try {
      const payload = {
        source_connection_id: wizardForm.source_connection_id,
        source_schema: wizardForm.source_schema || null,
        source_table: wizardForm.source_table,
        target_connection_id: wizardForm.target_connection_id,
        target_schema: wizardForm.target_schema || null,
        target_table: wizardForm.target_table || wizardForm.source_table,
        filter_query: wizardForm.filter_query || null,
        create_target_table: wizardForm.create_target_table,
        column_mappings: buildColumnMappings(),
      };
      await transfersAPI.create(payload);
      toast.success('Transfer started');
      setShowWizard(false);
      if (newParam === '1') setSearchParams({}, { replace: true });
      setWizardStep(1);
      setWizardForm({
        source_connection_id: '',
        source_schema: '',
        source_table: '',
        target_connection_id: '',
        target_schema: '',
        target_table: '',
        filter_query: '',
        create_target_table: true,
      });
      setSourceColumns([]);
      setColumnSelection({ include: {}, rename: {} });
      loadData();
    } catch (err) {
      const details = err.response?.data?.details;
      if (Array.isArray(details) && details.length > 0) {
        setWizardErrors(details.map((d) => `${d.field}: ${d.message}`));
        toast.error('Please fix the highlighted fields');
      } else {
        toast.error(err.response?.data?.message || 'Failed to create transfer');
      }
    }
  };

  // Reload the list whenever the URL status filter changes (deep-linkable).
  useEffect(() => {
    if (!loading) loadData();
    // loadData is recreated per render; the filter value is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Warn before a reload/tab close while an unsaved wizard is open.
  useEffect(() => {
    if (!showWizard) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [showWizard]);

  const cancelTransfer = async (id) => {
    try {
      await transfersAPI.cancel(id);
      toast.success('Transfer cancelled');
      setConfirmCancel(null);
      loadData();
    } catch {
      toast.error('Failed to cancel transfer');
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      completed: 'badge-success',
      running: 'badge-primary',
      failed: 'badge-danger',
      pending: 'badge-warning',
      cancelled: 'badge-neutral',
    };
    return map[status] || 'badge-neutral';
  };

  const formatDuration = (start, end) => {
    if (!start) return '–';
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const diff = Math.floor((e - s) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-overlay" role="status">
          <div className="spinner spinner-lg" aria-hidden="true"></div>
          <span>Loading transfers…</span>
        </div>
      </div>
    );
  }

  const setStatusFilter = (value) => {
    setSearchParams(value === 'all' ? {} : { status: value }, { replace: true });
  };

  const wizardHasContent = Boolean(
    wizardForm.source_table ||
    wizardForm.target_table ||
    wizardForm.filter_query ||
    wizardForm.target_connection_id,
  );

  const closeWizard = () => {
    setConfirmDiscard(false);
    setShowWizard(false);
    // Clear the deep link so a refresh does not reopen the wizard.
    if (newParam === '1') setSearchParams({}, { replace: true });
  };

  const requestCloseWizard = () => {
    if (wizardHasContent) setConfirmDiscard(true);
    else closeWizard();
  };

  const statusTabs = [
    { id: 'all', label: 'All' },
    { id: 'running', label: 'Running' },
    { id: 'completed', label: 'Completed' },
    { id: 'failed', label: 'Failed' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Data transfers</h1>
          <p>Move data between configured database connections</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowWizard(true);
              setWizardStep(1);
            }}
            id="btn-new-transfer"
          >
            <HiOutlinePlus aria-hidden="true" /> New transfer
          </button>
        </div>
      </div>

      {/* Transfer History */}
      <section className="card" aria-label="Transfer history">
        <div className="card-header">
          <h2 className="card-title">Transfer history</h2>
          <span className="card-subtitle">{transfers.length} in this view</span>
        </div>

        <TabList
          tabs={statusTabs}
          activeId={statusFilter}
          onChange={setStatusFilter}
          label="Filter transfers by status"
          idPrefix="transfer-status"
        />

        {transfers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <HiOutlineSwitchHorizontal aria-hidden="true" />
            </div>
            <h3>{statusFilter === 'all' ? 'No transfers yet' : `No ${statusFilter} transfers`}</h3>
            <p>
              {statusFilter === 'all'
                ? 'Create your first data transfer to move data between databases.'
                : 'Try another status, or clear the filter.'}
            </p>
            {statusFilter !== 'all' && (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setStatusFilter('all')}
              >
                Show all
              </button>
            )}
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th></th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Duration</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((tx) => {
                  const progress = tx.total_rows
                    ? Math.round((tx.transferred_rows / tx.total_rows) * 100)
                    : 0;
                  return (
                    <tr key={tx.id}>
                      <td>
                        <div className="transfer-endpoint-name">
                          {tx.source_connection_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-muted font-mono">{tx.source_table}</div>
                      </td>
                      <td>
                        <HiOutlineArrowRight className="transfer-arrow" aria-hidden="true" />
                      </td>
                      <td>
                        <div className="transfer-endpoint-name">
                          {tx.target_connection_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-muted font-mono">{tx.target_table}</div>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadge(tx.status)}`}>
                          <span className="badge-dot"></span>
                          {tx.status}
                        </span>
                      </td>
                      <td className="transfer-progress-cell">
                        {tx.status === 'running' ? (
                          <div>
                            <div
                              className="progress-bar progress-bar-spaced"
                              role="progressbar"
                              aria-label={`Progress of ${tx.source_table} transfer`}
                              aria-valuenow={tx.transferred_rows ?? 0}
                              aria-valuemin={0}
                              aria-valuemax={tx.total_rows ?? 0}
                              aria-valuetext={`${formatRows(tx.transferred_rows)} of ${formatRows(tx.total_rows)} rows`}
                            >
                              <div
                                className="progress-fill animated"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-muted">
                              {formatRows(tx.transferred_rows)} / {formatRows(tx.total_rows)} rows
                            </div>
                          </div>
                        ) : tx.status === 'completed' ? (
                          <span className="text-sm">{formatRows(tx.transferred_rows)} rows</span>
                        ) : (
                          <span className="text-muted text-sm">–</span>
                        )}
                      </td>
                      <td className="text-sm text-muted">
                        {formatDuration(tx.started_at, tx.completed_at)}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <Link
                            className="btn btn-ghost btn-sm"
                            to={`/transfers/${tx.id}`}
                            title="View details"
                            aria-label={`View details of ${tx.source_table} transfer`}
                          >
                            <HiOutlineEye aria-hidden="true" />
                          </Link>
                          {(tx.status === 'running' || tx.status === 'pending') && (
                            <button
                              className="btn btn-ghost btn-sm btn-danger-icon"
                              onClick={() => setConfirmCancel(tx)}
                              title="Cancel"
                              aria-label={`Cancel transfer of ${tx.source_table}`}
                            >
                              <HiOutlineStop />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Transfer Wizard Modal */}
      {showWizard && (
        <Modal
          title="New transfer"
          maxWidth="600px"
          onClose={requestCloseWizard}
          footer={
            <>
              {wizardStep > 1 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setWizardStep((s) => s - 1)}
                >
                  Back
                </button>
              )}
              <div style={{ flex: 1 }}></div>
              {wizardStep < 4 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (
                      wizardStep === 1 &&
                      (!wizardForm.source_connection_id || !wizardForm.source_table)
                    ) {
                      toast.error('Please select source connection and table');
                      return;
                    }
                    if (wizardStep === 2 && !wizardForm.target_connection_id) {
                      toast.error('Please select target connection');
                      return;
                    }
                    if (wizardStep === 2 && !wizardForm.target_table) {
                      setWizardForm((prev) => ({ ...prev, target_table: prev.source_table }));
                    }
                    if (wizardStep === 2) {
                      loadColumns();
                    }
                    setWizardStep((s) => s + 1);
                  }}
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleCreateTransfer}
                  id="btn-start-transfer"
                >
                  <HiOutlinePlay /> Start Transfer
                </button>
              )}
            </>
          }
        >
          {/* Wizard Steps Indicator */}
          {wizardErrors.length > 0 && (
            <div className="alert alert-danger" role="alert">
              <ul className="wizard-error-list">
                {wizardErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="wizard-steps wizard-steps-spaced">
            {['Source', 'Target', 'Options', 'Review'].map((label, i) => {
              const stepNum = i + 1;
              const isActive = wizardStep === stepNum;
              const isCompleted = wizardStep > stepNum;
              return (
                <div key={label} className="wizard-step-group">
                  <div
                    className={`wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                  >
                    <span className="wizard-step-label">{label}</span>
                  </div>
                  {i < 3 && (
                    <div className={`wizard-connector ${isCompleted ? 'completed' : ''}`}></div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Step 1: Source */}
          {wizardStep === 1 && (
            <div>
              <div className="form-group">
                <label className="form-label" htmlFor="wizard-source-connection">
                  Source Connection
                </label>
                <select
                  id="wizard-source-connection"
                  className="form-input form-select"
                  value={wizardForm.source_connection_id}
                  onChange={(e) => {
                    const connId = e.target.value;
                    setWizardForm((prev) => ({
                      ...prev,
                      source_connection_id: connId,
                      source_schema: '',
                      source_table: '',
                    }));
                    setSourceTables([]);
                    loadSchemas(connId, setSourceSchemas);
                  }}
                >
                  <option value="">Select a connection</option>
                  {connections
                    .filter((c) => c.is_active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.db_type})
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wizard-source-schema">
                  Source Schema
                </label>
                <select
                  id="wizard-source-schema"
                  className="form-input form-select"
                  value={wizardForm.source_schema}
                  disabled={!wizardForm.source_connection_id}
                  onChange={(e) => {
                    const schema = e.target.value;
                    setWizardForm((prev) => ({ ...prev, source_schema: schema, source_table: '' }));
                    loadTables(wizardForm.source_connection_id, schema, setSourceTables);
                  }}
                >
                  <option value="">Default schema</option>
                  {sourceSchemas.map((schema) => (
                    <option key={schema.name} value={schema.name}>
                      {schema.name} ({schema.table_count})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wizard-source-table">
                  Source Table
                </label>
                <select
                  id="wizard-source-table"
                  className="form-input form-select"
                  value={wizardForm.source_table}
                  disabled={tablesLoading || sourceTables.length === 0}
                  onChange={(e) =>
                    setWizardForm((prev) => ({ ...prev, source_table: e.target.value }))
                  }
                >
                  <option value="">
                    {tablesLoading
                      ? 'Loading tables…'
                      : sourceTables.length === 0
                        ? 'Select a schema first'
                        : 'Select a table'}
                  </option>
                  {sourceTables.map((t) => (
                    <option key={`${t.schema_name}.${t.name}`} value={t.name}>
                      {t.name}
                      {t.type === 'view' ? ' (view)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Target */}
          {wizardStep === 2 && (
            <div>
              <div className="form-group">
                <label className="form-label" htmlFor="wizard-target-connection">
                  Target Connection
                </label>
                <select
                  id="wizard-target-connection"
                  className="form-input form-select"
                  value={wizardForm.target_connection_id}
                  onChange={(e) => {
                    const connId = e.target.value;
                    setWizardForm((prev) => ({
                      ...prev,
                      target_connection_id: connId,
                      target_schema: '',
                    }));
                    loadSchemas(connId, setTargetSchemas);
                  }}
                >
                  <option value="">Select a connection</option>
                  {connections
                    .filter((c) => c.is_active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.db_type})
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wizard-target-schema">
                  Target Schema
                </label>
                <select
                  id="wizard-target-schema"
                  className="form-input form-select"
                  value={wizardForm.target_schema}
                  disabled={!wizardForm.target_connection_id}
                  onChange={(e) =>
                    setWizardForm((prev) => ({ ...prev, target_schema: e.target.value }))
                  }
                >
                  <option value="">Default schema</option>
                  {targetSchemas.map((schema) => (
                    <option key={schema.name} value={schema.name}>
                      {schema.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wizard-target-table">
                  Target Table Name
                </label>
                <input
                  id="wizard-target-table"
                  className="form-input"
                  value={wizardForm.target_table}
                  placeholder={wizardForm.source_table || 'Enter table name'}
                  onChange={(e) =>
                    setWizardForm((prev) => ({ ...prev, target_table: e.target.value }))
                  }
                />
                <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
                  Leave empty to use the same name as source. The table will be auto-created if it
                  doesn&apos;t exist.
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Options */}
          {wizardStep === 3 && (
            <div>
              <div className="form-group">
                <label className="form-label" htmlFor="wizard-filter">
                  Filter (optional SQL WHERE clause)
                </label>
                <input
                  id="wizard-filter"
                  className="form-input font-mono"
                  value={wizardForm.filter_query}
                  placeholder="status = 'active' AND created_at > '2024-01-01'…"
                  spellCheck="false"
                  autoComplete="off"
                  aria-describedby="wizard-filter-hint"
                  onChange={(e) =>
                    setWizardForm((prev) => ({ ...prev, filter_query: e.target.value }))
                  }
                />
                <span className="form-hint" id="wizard-filter-hint">
                  Plain column comparisons only. The server validates the clause before it runs.
                </span>
              </div>
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={wizardForm.create_target_table}
                  onChange={(e) =>
                    setWizardForm((prev) => ({ ...prev, create_target_table: e.target.checked }))
                  }
                />
                <span className="text-sm">Auto-create target table if it doesn&apos;t exist</span>
              </label>

              <div className="column-mapping-section">
                <div className="form-label">Columns</div>
                <div className="text-xs text-muted column-mapping-hint">
                  Untick columns to skip them; type a new name to rename them in the target table.
                </div>
                {columnsLoading ? (
                  <div className="loading-overlay" role="status">
                    <div className="spinner" aria-hidden="true"></div>
                    <span>Loading columns…</span>
                  </div>
                ) : sourceColumns.length === 0 ? (
                  <div className="text-muted text-sm">
                    Columns unavailable — all source columns will be transferred.
                  </div>
                ) : (
                  <div className="column-mapping-list">
                    {sourceColumns.map((col) => (
                      <div key={col.name} className="column-mapping-row">
                        <label className="form-checkbox column-mapping-name">
                          <input
                            type="checkbox"
                            checked={columnSelection.include[col.name] ?? true}
                            onChange={(e) =>
                              setColumnSelection((prev) => ({
                                ...prev,
                                include: { ...prev.include, [col.name]: e.target.checked },
                              }))
                            }
                          />
                          <span className="font-mono text-sm">{col.name}</span>
                        </label>
                        <span className="text-muted text-xs column-mapping-type">{col.type}</span>
                        <input
                          className="form-input form-input-sm column-mapping-rename"
                          placeholder="same name"
                          aria-label={`Target name for ${col.name}`}
                          value={columnSelection.rename[col.name] || ''}
                          disabled={!columnSelection.include[col.name]}
                          onChange={(e) =>
                            setColumnSelection((prev) => ({
                              ...prev,
                              rename: { ...prev.rename, [col.name]: e.target.value },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {wizardStep === 4 && (
            <div>
              <div className="transfer-summary">
                <div className="transfer-summary-grid">
                  <div>
                    <div className="field-label">Source</div>
                    <div className="font-semibold">
                      {connections.find((c) => c.id === wizardForm.source_connection_id)?.name ||
                        '–'}
                    </div>
                    <div className="font-mono text-sm text-muted">{wizardForm.source_table}</div>
                  </div>
                  <HiOutlineArrowRight className="transfer-summary-arrow" aria-hidden="true" />
                  <div>
                    <div className="field-label">Target</div>
                    <div className="font-semibold">
                      {connections.find((c) => c.id === wizardForm.target_connection_id)?.name ||
                        '–'}
                    </div>
                    <div className="font-mono text-sm text-muted">
                      {wizardForm.target_table || wizardForm.source_table}
                    </div>
                  </div>
                </div>
                {wizardForm.filter_query && (
                  <div className="transfer-summary-extra">
                    <div className="field-label">Filter</div>
                    <div className="font-mono text-sm" style={{ marginTop: '4px' }}>
                      {wizardForm.filter_query}
                    </div>
                  </div>
                )}
                {(() => {
                  const mappings = buildColumnMappings();
                  if (!mappings) return null;
                  const renamed = Object.entries(mappings).filter(([from, to]) => from !== to);
                  const skipped = sourceColumns.length - Object.keys(mappings).length;
                  return (
                    <div className="transfer-summary-extra">
                      <div className="field-label">Columns</div>
                      <div className="font-mono text-sm" style={{ marginTop: '4px' }}>
                        {Object.keys(mappings).length} of {sourceColumns.length} transferred
                        {renamed.length > 0 &&
                          ` · renamed: ${renamed
                            .map(([from, to]) => `${from} → ${to}`)
                            .join(', ')}`}
                        {skipped > 0 && ` · skipped: ${skipped}`}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Cancel Confirmation Modal */}
      {confirmCancel && (
        <Modal
          title="Cancel transfer"
          maxWidth="440px"
          onClose={() => setConfirmCancel(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmCancel(null)}
              >
                Keep running
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => cancelTransfer(confirmCancel.id)}
                id="btn-confirm-cancel"
              >
                Cancel transfer
              </button>
            </>
          }
        >
          <p className="text-sm">
            Cancel the transfer of <span className="font-mono">{confirmCancel.source_table}</span>{' '}
            to <span className="font-mono">{confirmCancel.target_table}</span>?
          </p>
          <p className="text-sm text-muted">
            Rows already staged are discarded. The target table is left untouched.
          </p>
        </Modal>
      )}

      {/* Discard unsaved wizard confirmation */}
      {confirmDiscard && (
        <Modal
          title="Discard this transfer?"
          maxWidth="440px"
          onClose={() => setConfirmDiscard(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDiscard(false)}
              >
                Keep editing
              </button>
              <button type="button" className="btn btn-danger" onClick={closeWizard}>
                Discard
              </button>
            </>
          }
        >
          <p className="text-sm text-muted">Your selections will be lost.</p>
        </Modal>
      )}
    </div>
  );
}

export default Transfers;
