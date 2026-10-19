/**
 * Transfer jobs - creation wizard and history
 */

import { useState, useEffect } from 'react';
import { connectionsAPI, discoveryAPI, transfersAPI } from '../api/client';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usePolling } from '../hooks/usePolling';
import {
  HiOutlinePlus,
  HiOutlinePlay,
  HiOutlineStop,
  HiOutlineEye,
  HiOutlineArrowRight,
} from 'react-icons/hi';

function Transfers() {
  const [transfers, setTransfers] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [showDetail, setShowDetail] = useState(null);
  const [detailLogs, setDetailLogs] = useState([]);
  const detailId = showDetail?.id ?? null;
  const location = useLocation();

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

  useEffect(() => {
    loadData();
    if (location.state?.sourceTable) {
      const st = location.state.sourceTable;
      setWizardForm(prev => ({
        ...prev,
        source_connection_id: st.connId,
        source_schema: st.schema,
        source_table: st.tableName,
      }));
      setShowWizard(true);
      setWizardStep(2);
    }
  }, []);

  // Poll for running transfers
  const hasRunning = transfers.some(t => t.status === 'running' || t.status === 'pending');
  usePolling(
    async () => {
      const res = await transfersAPI.list();
      setTransfers(res.data);
    },
    5000,
    hasRunning
  );

  const loadData = async () => {
    try {
      const [txRes, connRes] = await Promise.all([
        transfersAPI.list(),
        connectionsAPI.list(),
      ]);
      setTransfers(txRes.data);
      setConnections(connRes.data);
    } catch (err) {
      toast.error('Failed to load data');
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

  const handleCreateTransfer = async () => {
    try {
      const payload = {
        source_connection_id: wizardForm.source_connection_id,
        source_schema: wizardForm.source_schema || null,
        source_table: wizardForm.source_table,
        target_connection_id: wizardForm.target_connection_id,
        target_schema: wizardForm.target_schema || null,
        target_table: wizardForm.target_table,
        filter_query: wizardForm.filter_query || null,
        create_target_table: wizardForm.create_target_table,
      };
      await transfersAPI.create(payload);
      toast.success('Transfer started!');
      setShowWizard(false);
      setWizardStep(1);
      setWizardForm({
        source_connection_id: '', source_schema: '', source_table: '',
        target_connection_id: '', target_schema: '', target_table: '',
        filter_query: '', create_target_table: true,
      });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create transfer');
    }
  };

  const viewDetail = (transfer) => {
    setShowDetail(transfer);
    setDetailLogs([]);
  };

  // Keep an open detail modal in sync with the running job.
  const detailIsLive = showDetail?.status === 'running' || showDetail?.status === 'pending';
  usePolling(
    async () => {
      if (!detailId) return null;
      const [jobRes, logsRes] = await Promise.all([
        transfersAPI.get(detailId),
        transfersAPI.getLogs(detailId),
      ]);
      setShowDetail(jobRes.data);
      setDetailLogs(logsRes.data);
      return jobRes.data;
    },
    3000,
    Boolean(detailId) && detailIsLive
  );

  const cancelTransfer = async (id) => {
    try {
      await transfersAPI.cancel(id);
      toast.success('Transfer cancelled');
      loadData();
    } catch {
      toast.error('Failed to cancel transfer');
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      completed: 'badge-success', running: 'badge-primary', failed: 'badge-danger',
      pending: 'badge-warning', cancelled: 'badge-neutral',
    };
    return map[status] || 'badge-neutral';
  };

  const formatDuration = (start, end) => {
    if (!start) return '—';
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
        <div className="loading-overlay"><div className="spinner spinner-lg"></div></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header page-header-actions">
        <div>
          <h1>Data Transfers</h1>
          <p>Move data between configured database connections</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowWizard(true); setWizardStep(1); }} id="btn-new-transfer">
          <HiOutlinePlus /> New Transfer
        </button>
      </div>

      {/* Transfer History */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Transfer History</div>
        </div>

        {transfers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔄</div>
            <h3>No transfers yet</h3>
            <p>Create your first data transfer to move data between databases.</p>
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
                  const progress = tx.total_rows ? Math.round((tx.transferred_rows / tx.total_rows) * 100) : 0;
                  return (
                    <tr key={tx.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{tx.source_connection_name || 'Unknown'}</div>
                        <div className="text-xs text-muted font-mono">{tx.source_table}</div>
                      </td>
                      <td><HiOutlineArrowRight style={{ color: 'var(--color-text-muted)' }} /></td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{tx.target_connection_name || 'Unknown'}</div>
                        <div className="text-xs text-muted font-mono">{tx.target_table}</div>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadge(tx.status)}`}>
                          <span className="badge-dot"></span>
                          {tx.status}
                        </span>
                      </td>
                      <td style={{ minWidth: '140px' }}>
                        {tx.status === 'running' ? (
                          <div>
                            <div className="progress-bar" style={{ marginBottom: '4px' }}>
                              <div className="progress-fill animated" style={{ width: `${progress}%` }}></div>
                            </div>
                            <div className="text-xs text-muted">
                              {tx.transferred_rows?.toLocaleString()} / {tx.total_rows?.toLocaleString() || '?'} rows
                            </div>
                          </div>
                        ) : tx.status === 'completed' ? (
                          <span className="text-sm">{tx.transferred_rows?.toLocaleString()} rows</span>
                        ) : (
                          <span className="text-muted text-sm">—</span>
                        )}
                      </td>
                      <td className="text-sm text-muted">{formatDuration(tx.started_at, tx.completed_at)}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" onClick={() => viewDetail(tx)} title="View details">
                            <HiOutlineEye />
                          </button>
                          {(tx.status === 'running' || tx.status === 'pending') && (
                            <button className="btn btn-ghost btn-sm" onClick={() => cancelTransfer(tx.id)}
                              style={{ color: 'var(--color-danger)' }} title="Cancel">
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
      </div>

      {/* Transfer Wizard Modal */}
      {showWizard && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowWizard(false)}>
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>New Transfer</h2>
              <button className="modal-close" onClick={() => setShowWizard(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Wizard Steps Indicator */}
              <div className="wizard-steps" style={{ marginBottom: '28px' }}>
                {['Source', 'Target', 'Options', 'Review'].map((label, i) => {
                  const stepNum = i + 1;
                  const isActive = wizardStep === stepNum;
                  const isCompleted = wizardStep > stepNum;
                  return (
                    <div key={label} style={{ display: 'contents' }}>
                      <div className={`wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                        <div className="wizard-step-number">{isCompleted ? '✓' : stepNum}</div>
                        <span className="wizard-step-label">{label}</span>
                      </div>
                      {i < 3 && <div className={`wizard-connector ${isCompleted ? 'completed' : ''}`}></div>}
                    </div>
                  );
                })}
              </div>

              {/* Step 1: Source */}
              {wizardStep === 1 && (
                <div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="wizard-source-connection">Source Connection</label>
                    <select id="wizard-source-connection" className="form-input form-select" value={wizardForm.source_connection_id}
                      onChange={(e) => {
                        const connId = e.target.value;
                        setWizardForm(prev => ({
                          ...prev,
                          source_connection_id: connId,
                          source_schema: '',
                          source_table: '',
                        }));
                        setSourceTables([]);
                        loadSchemas(connId, setSourceSchemas);
                      }}>
                      <option value="">Select a connection</option>
                      {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.db_type})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="wizard-source-schema">Source Schema</label>
                    <select id="wizard-source-schema" className="form-input form-select"
                      value={wizardForm.source_schema}
                      disabled={!wizardForm.source_connection_id}
                      onChange={(e) => {
                        const schema = e.target.value;
                        setWizardForm(prev => ({ ...prev, source_schema: schema, source_table: '' }));
                        loadTables(wizardForm.source_connection_id, schema, setSourceTables);
                      }}>
                      <option value="">Default schema</option>
                      {sourceSchemas.map(schema => (
                        <option key={schema.name} value={schema.name}>
                          {schema.name} ({schema.table_count})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="wizard-source-table">Source Table</label>
                    <select id="wizard-source-table" className="form-input form-select" value={wizardForm.source_table}
                      disabled={tablesLoading || sourceTables.length === 0}
                      onChange={(e) => setWizardForm(prev => ({ ...prev, source_table: e.target.value }))}>
                      <option value="">
                        {tablesLoading ? 'Loading tables…' : sourceTables.length === 0
                          ? 'Select a schema first'
                          : 'Select a table'}
                      </option>
                      {sourceTables.map(t => (
                        <option key={`${t.schema_name}.${t.name}`} value={t.name}>
                          {t.name}{t.type === 'view' ? ' (view)' : ''}
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
                    <label className="form-label">Target Connection</label>
                    <select className="form-input form-select" value={wizardForm.target_connection_id}
                      onChange={(e) => {
                        const connId = e.target.value;
                        setWizardForm(prev => ({
                          ...prev,
                          target_connection_id: connId,
                          target_schema: '',
                        }));
                        loadSchemas(connId, setTargetSchemas);
                      }}>
                      <option value="">Select a connection</option>
                      {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.db_type})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="wizard-target-schema">Target Schema</label>
                    <select id="wizard-target-schema" className="form-input form-select"
                      value={wizardForm.target_schema}
                      disabled={!wizardForm.target_connection_id}
                      onChange={(e) => setWizardForm(prev => ({ ...prev, target_schema: e.target.value }))}>
                      <option value="">Default schema</option>
                      {targetSchemas.map(schema => (
                        <option key={schema.name} value={schema.name}>{schema.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="wizard-target-table">Target Table Name</label>
                    <input id="wizard-target-table" className="form-input" value={wizardForm.target_table}
                      placeholder={wizardForm.source_table || 'Enter table name'}
                      onChange={(e) => setWizardForm(prev => ({ ...prev, target_table: e.target.value }))} />
                    <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
                      Leave empty to use the same name as source. The table will be auto-created if it doesn't exist.
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Options */}
              {wizardStep === 3 && (
                <div>
                  <div className="form-group">
                    <label className="form-label">Filter (Optional SQL WHERE clause)</label>
                    <input className="form-input font-mono" value={wizardForm.filter_query}
                      placeholder="e.g. status = 'active' AND created_at > '2024-01-01'"
                      onChange={(e) => setWizardForm(prev => ({ ...prev, filter_query: e.target.value }))} />
                  </div>
                  <label className="form-checkbox">
                    <input type="checkbox" checked={wizardForm.create_target_table}
                      onChange={(e) => setWizardForm(prev => ({ ...prev, create_target_table: e.target.checked }))} />
                    <span className="text-sm">Auto-create target table if it doesn't exist</span>
                  </label>
                </div>
              )}

              {/* Step 4: Review */}
              {wizardStep === 4 && (
                <div>
                  <div style={{ background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
                      <div>
                        <div className="text-xs text-muted" style={{ marginBottom: '4px' }}>SOURCE</div>
                        <div style={{ fontWeight: 600 }}>
                          {connections.find(c => c.id === wizardForm.source_connection_id)?.name || '—'}
                        </div>
                        <div className="font-mono text-sm text-muted">{wizardForm.source_table}</div>
                      </div>
                      <HiOutlineArrowRight style={{ fontSize: '24px', color: 'var(--color-primary)' }} />
                      <div>
                        <div className="text-xs text-muted" style={{ marginBottom: '4px' }}>TARGET</div>
                        <div style={{ fontWeight: 600 }}>
                          {connections.find(c => c.id === wizardForm.target_connection_id)?.name || '—'}
                        </div>
                        <div className="font-mono text-sm text-muted">
                          {wizardForm.target_table || wizardForm.source_table}
                        </div>
                      </div>
                    </div>
                    {wizardForm.filter_query && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                        <div className="text-xs text-muted">FILTER</div>
                        <div className="font-mono text-sm" style={{ marginTop: '4px' }}>{wizardForm.filter_query}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {wizardStep > 1 && (
                <button className="btn btn-secondary" onClick={() => setWizardStep(s => s - 1)}>Back</button>
              )}
              <div style={{ flex: 1 }}></div>
              {wizardStep < 4 ? (
                <button className="btn btn-primary" onClick={() => {
                  if (wizardStep === 1 && (!wizardForm.source_connection_id || !wizardForm.source_table)) {
                    toast.error('Please select source connection and table');
                    return;
                  }
                  if (wizardStep === 2 && !wizardForm.target_connection_id) {
                    toast.error('Please select target connection');
                    return;
                  }
                  if (wizardStep === 2 && !wizardForm.target_table) {
                    setWizardForm(prev => ({ ...prev, target_table: prev.source_table }));
                  }
                  setWizardStep(s => s + 1);
                }}>
                  Next
                </button>
              ) : (
                <button className="btn btn-success" onClick={handleCreateTransfer} id="btn-start-transfer">
                  <HiOutlinePlay /> Start Transfer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transfer Detail Modal */}
      {showDetail && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowDetail(null)}>
          <div className="modal" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2>Transfer Details</h2>
              <button className="modal-close" onClick={() => setShowDetail(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <div className="text-xs text-muted">SOURCE</div>
                  <div style={{ fontWeight: 600 }}>{showDetail.source_connection_name}</div>
                  <div className="font-mono text-sm text-muted">{showDetail.source_table}</div>
                </div>
                <HiOutlineArrowRight style={{ fontSize: '24px', color: 'var(--color-primary)' }} />
                <div>
                  <div className="text-xs text-muted">TARGET</div>
                  <div style={{ fontWeight: 600 }}>{showDetail.target_connection_name}</div>
                  <div className="font-mono text-sm text-muted">{showDetail.target_table}</div>
                </div>
              </div>

              <div className="flex gap-3 mb-4">
                <span className={`badge ${getStatusBadge(showDetail.status)}`}>
                  <span className="badge-dot"></span>{showDetail.status}
                </span>
                <span className="text-sm text-muted">
                  {showDetail.transferred_rows?.toLocaleString()} / {showDetail.total_rows?.toLocaleString() || '?'} rows
                </span>
                <span className="text-sm text-muted">
                  Duration: {formatDuration(showDetail.started_at, showDetail.completed_at)}
                </span>
              </div>

              {showDetail.status === 'running' && showDetail.total_rows && (
                <div className="progress-bar mb-4" style={{ height: '8px' }}>
                  <div className="progress-fill animated"
                    style={{ width: `${Math.round((showDetail.transferred_rows / showDetail.total_rows) * 100)}%` }}></div>
                </div>
              )}

              {showDetail.error_message && (
                <div style={{ background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '16px' }}>
                  <div className="text-sm font-bold" style={{ color: 'var(--color-danger)', marginBottom: '4px' }}>Error</div>
                  <div className="text-sm font-mono">{showDetail.error_message}</div>
                </div>
              )}

              <div className="card-title mb-4">Execution Logs</div>
              <div className="log-viewer">
                {detailLogs.length === 0 ? (
                  <div className="text-muted text-sm" style={{ padding: '20px', textAlign: 'center' }}>No logs available</div>
                ) : (
                  detailLogs.map((log) => (
                    <div key={log.id} className="log-entry">
                      <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className={`log-level ${log.level}`}>{log.level}</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transfers;
