import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

const loginMock = vi.fn();
const registerMock = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: loginMock, register: registerMock }),
}));

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs in with the entered credentials', async () => {
    loginMock.mockResolvedValue({});
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email Address'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith('user@example.com', 'supersecret123'),
    );
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('registers with name, email and password after toggling modes', async () => {
    registerMock.mockResolvedValue({});
    renderLogin();
    const user = userEvent.setup();

    await user.click(screen.getByText('Create one'));
    await user.type(screen.getByLabelText('Full Name'), 'New User');
    await user.type(screen.getByLabelText('Email Address'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret123');
    await user.type(screen.getByLabelText('Confirm Password'), 'supersecret123');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith('new@example.com', 'supersecret123', 'New User'),
    );
  });

  it('refuses registration when the passwords do not match', async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.click(screen.getByText('Create one'));
    await user.type(screen.getByLabelText('Full Name'), 'New User');
    await user.type(screen.getByLabelText('Email Address'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret123');
    await user.type(screen.getByLabelText('Confirm Password'), 'different-pass');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    // Give the async handler a chance to run
    await waitFor(() => expect(registerMock).not.toHaveBeenCalled());
  });

  it('keeps the button disabled while a login is in flight', async () => {
    let resolveLogin;
    loginMock.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email Address'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    // While in flight the label is replaced by a spinner, so query by id.
    expect(document.getElementById('btn-login-submit')).toBeDisabled();

    resolveLogin({});
    await waitFor(() => expect(document.getElementById('btn-login-submit')).toBeEnabled());
  });
});
