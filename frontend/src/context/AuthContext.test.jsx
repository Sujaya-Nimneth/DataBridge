import { render, screen, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const loginMock = vi.fn();
const registerMock = vi.fn();
const logoutMock = vi.fn().mockResolvedValue({});

vi.mock('../api/client', () => ({
  authAPI: {
    login: (...args) => loginMock(...args),
    register: (...args) => registerMock(...args),
    logout: (...args) => logoutMock(...args),
  },
}));

const tokenResponse = {
  data: {
    access_token: 'access-1',
    refresh_token: 'refresh-1',
    user: { id: 'u1', email: 'user@example.com', full_name: 'User' },
  },
};

function Probe() {
  const { user, loading, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="user">{user ? user.email : 'anonymous'}</div>
      <div data-testid="loading">{String(loading)}</div>
      <button onClick={() => login('user@example.com', 'pw')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts as anonymous with loading finished after mount', async () => {
    renderProbe();
    expect(screen.getByTestId('user').textContent).toBe('anonymous');
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('restores a persisted session from localStorage', () => {
    localStorage.setItem('access_token', 'token');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', email: 'saved@example.com' }));
    renderProbe();
    expect(screen.getByTestId('user').textContent).toBe('saved@example.com');
  });

  it('discards a corrupted persisted user', () => {
    localStorage.setItem('access_token', 'token');
    localStorage.setItem('user', '{not json');
    renderProbe();
    expect(screen.getByTestId('user').textContent).toBe('anonymous');
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('login stores tokens and user', async () => {
    loginMock.mockResolvedValue(tokenResponse);
    renderProbe();

    await act(async () => {
      screen.getByText('login').click();
    });

    expect(loginMock).toHaveBeenCalledWith({ email: 'user@example.com', password: 'pw' });
    expect(localStorage.getItem('access_token')).toBe('access-1');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-1');
    expect(screen.getByTestId('user').textContent).toBe('user@example.com');
  });

  it('logout revokes server-side and clears storage and user state', async () => {
    localStorage.setItem('access_token', 'access-1');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', email: 'user@example.com' }));
    renderProbe();

    await act(async () => {
      screen.getByText('logout').click();
    });

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(screen.getByTestId('user').textContent).toBe('anonymous');
  });
});
