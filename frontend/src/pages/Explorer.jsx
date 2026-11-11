/**
 * Data explorer - schema tree, column inspector, and data preview
 */

import { useState, useEffect, useRef } from 'react';
import { connectionsAPI, discoveryAPI } from '../api/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TabList } from '../components/Tabs';
import toast from 'react-hot-toast';
import {
  HiOutlineChevronRight,
  HiOutlineChevronDown,
  HiOutlineDatabase,
  HiOutlineTable,
  HiOutlineKey,
  HiOutlineEye,
  HiOutlineSearch,
} from 'react-icons/hi';

function Explorer() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [treeData, setTreeData] = useState({});
  const [expanded, setExpanded] = useState({});
  const [selectedTable, setSelectedTable] = useState(null);
  const [columns, setColumns] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('columns');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const restoredRef = useRef(false);

  useEffect(() => {
    loadConnections();
  }, []);

  // Restore a deep-linked table selection once the connection list is ready.
  useEffect(() => {
    if (loading || restoredRef.current || connections.length === 0) return;
    const connId = searchParams.get('conn');
    const schema = searchParams.get('schema') || '';
    const table = searchParams.get('table');
    if (!connId || !table) return;
    const conn = connections.find((c) => c.id === connId);
    if (!conn) return;
    restoredRef.current = true;

    let cancelled = false;
    const restore = async () => {
      try {
        const [schemasRes, tablesRes] = await Promise.all([
          discoveryAPI.getSchemas(connId),
          discoveryAPI.getTables(connId, schema || undefined),
        ]);
        if (cancelled) return;
        setTreeData((prev) => ({
          ...prev,
          [`schemas-${connId}`]: schemasRes.data,
          [`tables-${connId}-${schema}`]: tablesRes.data,
        }));
        setExpanded((prev) => ({
          ...prev,
          [`conn-${connId}`]: true,
          [`schema-${connId}-${schema}`]: true,
        }));
        await selectTable(connId, schema, table, conn.name, true);
        if (!cancelled && searchParams.get('tab') === 'preview') {
          try {
            const previewRes = await discoveryAPI.previewData(connId, table, {
              schema,
              page: 1,
              page_size: 50,
            });
            if (!cancelled) setPreview(previewRes.data);
          } catch {
            if (!cancelled) toast.error('Failed to load data preview');
          }
        }
      } catch {
        if (!cancelled) toast.error("Couldn't restore the selected table");
      }
    };
    restore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, connections]);

  const loadConnections = async () => {
    setLoadFailed(false);
    setLoading(true);
    try {
      const res = await connectionsAPI.list();
      // Deactivated connections cannot be used for discovery.
      setConnections(res.data.filter((c) => c.is_active));
    } catch {
      setLoadFailed(true);
      toast.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = async (key, type, data) => {
    const newExpanded = { ...expanded };
    if (newExpanded[key]) {
      delete newExpanded[key];
      setExpanded(newExpanded);
      return;
    }
    newExpanded[key] = true;
    setExpanded(newExpanded);

    if (type === 'connection') {
      try {
        const res = await discoveryAPI.getSchemas(data.id);
        setTreeData((prev) => ({ ...prev, [`schemas-${data.id}`]: res.data }));
      } catch {
        toast.error('Failed to load schemas');
      }
    } else if (type === 'schema') {
      try {
        const res = await discoveryAPI.getTables(data.connId, data.schema);
        setTreeData((prev) => ({ ...prev, [`tables-${data.connId}-${data.schema}`]: res.data }));
      } catch {
        toast.error('Failed to load tables');
      }
    }
  };

  const setTab = (tab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === 'columns') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const selectTable = async (connId, schema, tableName, connName, keepTab = false) => {
    setSelectedTable({ connId, schema, tableName, connName });
    setPreview(null);
    const next = new URLSearchParams({ conn: connId, schema: schema || '', table: tableName });
    if (keepTab && searchParams.get('tab') === 'preview') next.set('tab', 'preview');
    setSearchParams(next, { replace: true });
    setActiveTab(keepTab && searchParams.get('tab') === 'preview' ? 'preview' : 'columns');

    try {
      const res = await discoveryAPI.getColumns(connId, tableName, schema);
      setColumns(res.data);
    } catch {
      toast.error('Failed to load columns');
    }
  };

  const loadPreview = async () => {
    if (!selectedTable) return;
    setPreviewLoading(true);
    setTab('preview');
    try {
      const res = await discoveryAPI.previewData(selectedTable.connId, selectedTable.tableName, {
        schema: selectedTable.schema,
        page: 1,
        page_size: 50,
      });
      setPreview(res.data);
    } catch {
      toast.error('Failed to load data preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-overlay" role="status">
          <div className="spinner spinner-lg" aria-hidden="true"></div>
          <span>Loading connections…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Data Explorer</h1>
        <p>Browse database structures and preview data</p>
      </div>

      {loadFailed ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <HiOutlineDatabase aria-hidden="true" />
            </div>
            <h3>Could not load connections</h3>
            <p>The server did not respond. Check that the API is running.</p>
            <button className="btn btn-primary" onClick={loadConnections}>
              Retry
            </button>
          </div>
        </div>
      ) : connections.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <HiOutlineSearch aria-hidden="true" />
            </div>
            <h3>No connections available</h3>
            <p>Add a database connection first to start exploring data.</p>
            <button className="btn btn-primary" onClick={() => navigate('/connections')}>
              Add a connection
            </button>
          </div>
        </div>
      ) : (
        <div className="explorer-layout">
          {/* Tree Sidebar */}
          <div className="explorer-sidebar">
            <h2 className="section-label">Database objects</h2>
            <div className="tree-view" role="tree" aria-label="Database objects">
              {connections.map((conn) => {
                const connKey = `conn-${conn.id}`;
                const isExpanded = expanded[connKey];
                const schemas = treeData[`schemas-${conn.id}`] || [];

                return (
                  <div
                    key={conn.id}
                    className="tree-node"
                    role="treeitem"
                    aria-expanded={!!isExpanded}
                  >
                    <button
                      type="button"
                      className="tree-node-button"
                      onClick={() => toggleNode(connKey, 'connection', conn)}
                    >
                      <span className="tree-node-icon">
                        {isExpanded ? <HiOutlineChevronDown /> : <HiOutlineChevronRight />}
                      </span>
                      <span className="tree-node-icon" aria-hidden="true">
                        <HiOutlineDatabase />
                      </span>
                      <span className="tree-node-label">{conn.name}</span>
                    </button>

                    {isExpanded && (
                      <div className="tree-children">
                        {schemas.map((schema) => {
                          const schemaKey = `schema-${conn.id}-${schema.name}`;
                          const isSchemaExpanded = expanded[schemaKey];
                          const tables = treeData[`tables-${conn.id}-${schema.name}`] || [];

                          return (
                            <div
                              key={schema.name}
                              className="tree-node"
                              role="treeitem"
                              aria-expanded={!!isSchemaExpanded}
                            >
                              <button
                                type="button"
                                className="tree-node-button"
                                onClick={() =>
                                  toggleNode(schemaKey, 'schema', {
                                    connId: conn.id,
                                    schema: schema.name,
                                  })
                                }
                              >
                                <span className="tree-node-icon">
                                  {isSchemaExpanded ? (
                                    <HiOutlineChevronDown />
                                  ) : (
                                    <HiOutlineChevronRight />
                                  )}
                                </span>
                                <span className="tree-node-label">
                                  {schema.name}{' '}
                                  <span className="text-muted text-xs">({schema.table_count})</span>
                                </span>
                              </button>

                              {isSchemaExpanded && (
                                <div className="tree-children">
                                  {tables.map((table) => {
                                    const isSelected =
                                      selectedTable?.connId === conn.id &&
                                      selectedTable?.schema === schema.name &&
                                      selectedTable?.tableName === table.name;

                                    return (
                                      <div key={table.name} className="tree-node">
                                        <button
                                          type="button"
                                          className={`tree-node-button ${isSelected ? 'selected' : ''}`}
                                          aria-current={isSelected ? 'true' : undefined}
                                          onClick={() =>
                                            selectTable(conn.id, schema.name, table.name, conn.name)
                                          }
                                        >
                                          <span
                                            className="tree-node-icon"
                                            style={{
                                              color:
                                                table.type === 'view'
                                                  ? 'var(--color-info)'
                                                  : 'var(--color-text-tertiary)',
                                            }}
                                          >
                                            {table.type === 'view' ? (
                                              <HiOutlineEye />
                                            ) : (
                                              <HiOutlineTable />
                                            )}
                                          </span>
                                          <span className="tree-node-label">{table.name}</span>
                                        </button>
                                      </div>
                                    );
                                  })}
                                  {tables.length === 0 && (
                                    <div
                                      className="text-muted text-sm"
                                      style={{ padding: '8px 32px' }}
                                    >
                                      No tables found
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {schemas.length === 0 && (
                          <div className="text-muted text-sm" style={{ padding: '8px 24px' }}>
                            Loading schemas…
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="explorer-main">
            {selectedTable ? (
              <>
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="card-title">
                        {selectedTable.connName} / {selectedTable.schema} /{' '}
                        {selectedTable.tableName}
                      </div>
                      <div className="card-subtitle">{columns.length} columns</div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        navigate('/transfers', { state: { sourceTable: selectedTable } })
                      }
                    >
                      Transfer this table
                    </button>
                  </div>

                  <TabList
                    tabs={[
                      { id: 'columns', label: 'Columns' },
                      { id: 'preview', label: 'Data preview' },
                    ]}
                    activeId={activeTab}
                    onChange={(id) => (id === 'preview' ? loadPreview() : setTab('columns'))}
                    label="Table views"
                    idPrefix="explorer"
                  />

                  {activeTab === 'columns' && (
                    <div
                      className="data-table-wrapper"
                      role="tabpanel"
                      id="explorer-panel-columns"
                      aria-labelledby="explorer-columns"
                    >
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Column</th>
                            <th>Type</th>
                            <th>Nullable</th>
                            <th>Key</th>
                            <th>Default</th>
                          </tr>
                        </thead>
                        <tbody>
                          {columns.map((col) => (
                            <tr key={col.name}>
                              <td>
                                <span style={{ fontWeight: '600' }}>{col.name}</span>
                              </td>
                              <td>
                                <span className="font-mono text-sm">{col.type}</span>
                              </td>
                              <td>
                                {col.nullable ? (
                                  <span className="text-muted">Yes</span>
                                ) : (
                                  <span style={{ color: 'var(--color-warning)' }}>No</span>
                                )}
                              </td>
                              <td>
                                {col.is_primary_key && (
                                  <span className="badge badge-warning">
                                    <HiOutlineKey /> PK
                                  </span>
                                )}
                                {col.is_foreign_key && <span className="badge badge-info">FK</span>}
                              </td>
                              <td className="text-muted font-mono text-sm">{col.default || '–'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === 'preview' && (
                    <div
                      role="tabpanel"
                      id="explorer-panel-preview"
                      aria-labelledby="explorer-preview"
                    >
                      {previewLoading ? (
                        <div className="loading-overlay" role="status">
                          <div className="spinner spinner-lg" aria-hidden="true"></div>
                          <span>Loading preview…</span>
                        </div>
                      ) : preview ? (
                        <>
                          <div className="text-sm text-muted mb-4">
                            Showing {preview.rows.length} of{' '}
                            {new Intl.NumberFormat().format(preview.total_rows)} rows
                          </div>
                          <div
                            className="data-table-wrapper"
                            style={{ maxHeight: '500px', overflowY: 'auto' }}
                          >
                            <table className="data-table">
                              <thead>
                                <tr>
                                  {preview.columns.map((col) => (
                                    <th key={col}>{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {preview.rows.map((row, i) => (
                                  <tr key={i}>
                                    {row.map((cell, j) => (
                                      <td key={j}>
                                        {cell ?? <span className="text-muted">null</span>}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <HiOutlineSearch aria-hidden="true" />
                  </div>
                  <h3>Select a table</h3>
                  <p>Expand a connection in the tree to browse schemas, tables, and columns.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Explorer;
