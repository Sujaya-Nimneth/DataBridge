/**
 * Sign in / Create account. The first screen says plainly what this is and
 * what to do; errors appear beside the field they belong to.
 */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function Login() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });
  const [fieldError, setFieldError] = useState(null);
  const [serverError, setServerError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldError(null);
    setServerError(null);

    if (isRegister && form.password !== form.confirmPassword) {
      setFieldError({ field: 'confirmPassword', message: 'Passwords do not match.' });
      document.getElementById('input-confirm-password')?.focus();
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(form.email, form.password, form.fullName);
        toast.success('Account created');
      } else {
        await login(form.email, form.password);
        toast.success('Signed in');
      }
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Check your email and password, then try again.';
      setServerError(message);
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldError?.field === field) setFieldError(null);
  };

  const toggleMode = () => {
    setIsRegister((prev) => !prev);
    setFieldError(null);
    setServerError(null);
  };

  return (
    <div className="login-page">
      <main className="login-card">
        <div className="login-header">
          <div className="login-logo" aria-hidden="true">
            D
          </div>
          <h1>{isRegister ? 'Create your account' : 'Sign in to DataBridge'}</h1>
          <p>
            {isRegister
              ? 'Connect your databases and start moving data.'
              : 'Connect to your databases, explore schemas, and run transfers.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} aria-label={isRegister ? 'Registration form' : 'Sign-in form'} noValidate>
          {serverError && (
            <div className="alert alert-danger" role="alert">
              <span>{serverError}</span>
            </div>
          )}

          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="input-fullname">
                Full Name
              </label>
              <input
                id="input-fullname"
                className="form-input"
                type="text"
                placeholder="Jane Doe…"
                autoComplete="name"
                spellCheck="false"
                value={form.fullName}
                onChange={(e) => updateForm('fullName', e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="input-email">
              Email Address
            </label>
            <input
              id="input-email"
              className="form-input"
              type="email"
              placeholder="you@example.com…"
              autoComplete="email"
              spellCheck="false"
              value={form.email}
              onChange={(e) => updateForm('email', e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="input-password">
              Password
            </label>
            <input
              id="input-password"
              className="form-input"
              type="password"
              placeholder="••••••••"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={(e) => updateForm('password', e.target.value)}
              minLength={8}
              aria-describedby="password-hint"
              required
            />
            {isRegister && (
              <span className="form-hint" id="password-hint">
                At least 8 characters.
              </span>
            )}
          </div>

          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="input-confirm-password">
                Confirm Password
              </label>
              <input
                id="input-confirm-password"
                className={`form-input ${fieldError?.field === 'confirmPassword' ? 'input-invalid' : ''}`}
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => updateForm('confirmPassword', e.target.value)}
                minLength={8}
                aria-invalid={fieldError?.field === 'confirmPassword' ? 'true' : undefined}
                aria-describedby={fieldError?.field === 'confirmPassword' ? 'confirm-error' : undefined}
                required
              />
              {fieldError?.field === 'confirmPassword' && (
                <span className="form-error" id="confirm-error" role="alert">
                  {fieldError.message}
                </span>
              )}
            </div>
          )}

          <button
            id="btn-login-submit"
            className="btn btn-primary w-full btn-lg"
            type="submit"
            disabled={loading}
            style={{ justifyContent: 'center', marginTop: '8px' }}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                <span>Signing in…</span>
              </>
            ) : isRegister ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-toggle">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" onClick={toggleMode} id="btn-toggle-auth">
            {isRegister ? 'Sign In' : 'Create one'}
          </button>
        </div>
      </main>
    </div>
  );
}

export default Login;
