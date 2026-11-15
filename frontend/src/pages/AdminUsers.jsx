/**
 * Admin → Users. Promoted from a Monitoring tab to its own route so it
 * deep-links and has a predictable Back. Role-gated in the UI; the API also
 * enforces the admin role (403 otherwise).
 *
 * Built from the Astryx table page template: the Card frame holds a data-driven
 * Table; statuses use the shared StatusBadge (text + tint, never colour-only);
 * figures are right-aligned with Intl formatting. Data fetching, the role gate,
 * the aria-live finding and the Back link are unchanged.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SkeletonRows, EmptyState, InlineError } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Card } from '@astryxdesign/core/Card';
import { Heading, Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Button } from '@astryxdesign/core/Button';
import { Table, proportional } from '@astryxdesign/core/Table';
import { HiOutlineArrowLeft } from 'react-icons/hi';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const numberFormat = new Intl.NumberFormat();

const columns = [
  {
    key: 'full_name',
    header: 'Name',
    width: proportional(2),
    renderCell: (u) => u.full_name || '–',
  },
  {
    key: 'email',
    header: 'Email',
    width: proportional(2),
    renderCell: (u) => <Text type="supporting">{u.email}</Text>,
  },
  {
    key: 'role',
    header: 'Role',
    renderCell: (u) => <StatusBadge status={u.role} />,
  },
  {
    key: 'is_active',
    header: 'Status',
    renderCell: (u) => (
      <StatusBadge
        status={u.is_active ? 'active' : 'inactive'}
        label={u.is_active ? 'active' : 'inactive'}
      />
    ),
  },
  {
    key: 'connection_count',
    header: 'Connections',
    align: 'end',
    renderCell: (u) => numberFormat.format(u.connection_count),
  },
  {
    key: 'transfer_count',
    header: 'Transfers',
    align: 'end',
    renderCell: (u) => numberFormat.format(u.transfer_count),
  },
  {
    key: 'created_at',
    header: 'Joined',
    renderCell: (u) => <Text type="supporting">{dateFormat.format(new Date(u.created_at))}</Text>,
  },
];

function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminAPI.listUsers();
      setUsers(res.data);
    } catch (err) {
      setError(
        err.response?.status === 403
          ? 'You need the admin role to see this page.'
          : "Couldn't load users.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
    else setLoading(false);
  }, [user?.role]);

  if (user?.role !== 'admin') {
    return (
      <VStack gap={4} padding={4}>
        <Heading level={1}>Users</Heading>
        <Card>
          <EmptyState
            title="Admins only"
            action={
              <Link className="btn btn-secondary" to="/">
                Back to dashboard
              </Link>
            }
          >
            This page lists every account on the platform. Ask an admin if you need access.
          </EmptyState>
        </Card>
      </VStack>
    );
  }

  return (
    <VStack gap={4} padding={4}>
      <Link className="detail-head" to="/monitoring">
        <Text type="supporting">
          <HiOutlineArrowLeft aria-hidden="true" /> Monitoring
        </Text>
      </Link>

      <HStack gap={4} align="center" justify="between">
        <VStack gap={1}>
          <Heading level={1}>Users</Heading>
          <Text type="supporting" color="secondary" aria-live="polite">
            {loading
              ? 'Loading…'
              : `${numberFormat.format(users.length)} registered account${users.length === 1 ? '' : 's'}.`}
          </Text>
        </VStack>
        <Button label="Refresh" variant="secondary" onClick={load} isDisabled={loading} />
      </HStack>

      {error && <InlineError message={error} onRetry={load} />}

      <section aria-label="Registered users">
        <Card padding={0}>
          {loading ? (
            <SkeletonRows rows={4} />
          ) : error ? null : users.length === 0 ? (
            <EmptyState title="No users found">
              Accounts appear here once someone registers.
            </EmptyState>
          ) : (
            <Table
              data={users}
              columns={columns}
              idKey="id"
              density="compact"
              dividers="rows"
              hasHover
            />
          )}
        </Card>
      </section>
    </VStack>
  );
}

export default AdminUsers;
