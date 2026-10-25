/**
 * Data explorer - schema tree, column inspector, and data preview
 */

import { useState, useEffect } from 'react';
import { connectionsAPI, discoveryAPI } from '../api/client';
import { useNavigate } from 'react-router-dom';
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
  const [treeData, setTreeData] = useState({});
  const [expanded, setExpanded] = useState({});
  const [selectedTable, setSelectedTable] = useState(null);
  const [columns, setColumns] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('columns');
  const navigate = useNavigate();

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const res = await connectionsAPI.list();
      setConnections(res.data);
    } catch {
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

  const selectTable = async (connId, schema, tableName, connName) => {
    setSelectedTable({ connId, schema, tableName, connName });
    setActiveTab('columns');
    setPreview(null);

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
    setActiveTab('preview');
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
        <div className="loading-overlay">
          <div className="spinner spinner-lg"></div>
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

      {connections.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <HiOutlineSearch aria-hidden="true" />
            </div>
            <h3>No connections available</h3>
            <p>Create a database connection first to start exploring data.</p>
            <button className="btn btn-primary" onClick={() => navigate('/connections')}>
              Add Connection
            </button>
          </div>
        </div>
      ) : (
        <div className="explorer-layout">
          {/* Tree Sidebar */}
          <div className="explorer-sidebar">
            <div
              style={{
                padding: '8px 4px',
                marginBottom: '8px',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Database Objects
            </div>
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
                      <span
                        className="tree-node-icon"
                        style={{ color: conn.db_type === 'postgresql' ? '#6699ff' : '#00b4d8' }}
                      >
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
                            Loading schemas...
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
                      Transfer This Table
                    </button>
                  </div>

                  <div className="tabs" role="tablist" aria-label="Table views">
                    <button
                      type="button"
                      role="tab"
                      id="tab-columns"
                      aria-selected={activeTab === 'columns'}
                      aria-controls="panel-columns"
                      className={`tab ${activeTab === 'columns' ? 'active' : ''}`}
                      onClick={() => setActiveTab('columns')}
                    >
                      Columns
                    </button>
                    <button
                      type="button"
                      role="tab"
                      id="tab-preview"
                      aria-selected={activeTab === 'preview'}
                      aria-controls="panel-preview"
                      className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
                      onClick={loadPreview}
                    >
                      Data Preview
                    </button>
                  </div>

                  {activeTab === 'columns' && (
                    <div
                      className="data-table-wrapper"
                      role="tabpanel"
                      id="panel-columns"
                      aria-labelledby="tab-columns"
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
                              <td className="text-muted font-mono text-sm">{col.default || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === 'preview' &&
                    (previewLoading ? (
                      <div className="loading-overlay">
                        <div className="spinner spinner-lg"></div>
                      </div>
                    ) : preview ? (
                      <>
                        <div className="text-sm text-muted mb-4">
                          Showing {preview.rows.length} of {preview.total_rows.toLocaleString()}{' '}
                          rows
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
                                      {cell ?? <span className="text-muted">NULL</span>}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : null)}
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
