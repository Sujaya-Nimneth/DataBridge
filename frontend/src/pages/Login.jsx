/**
 * Login / Registration page with glassmorphism card design.
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
    fullName: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRegister) {
        await register(form.email, form.password, form.fullName);
        toast.success('Account created successfully!');
      } else {
        await login(form.email, form.password);
        toast.success('Welcome back!');
      }
    } catch (err) {
      const message =
        err.response?.data?.message || err.response?.data?.detail || 'Authentication failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">D</div>
          <h1>{isRegister ? 'Create Account' : 'Welcome Back'}</h1>
          <p>{isRegister ? 'Get started with DataBridge' : 'Sign in to your DataBridge account'}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="input-fullname">
                Full Name
              </label>
              <input
                id="input-fullname"
                className="form-input"
                type="text"
                placeholder="John Doe"
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
              placeholder="you@example.com"
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
              value={form.password}
              onChange={(e) => updateForm('password', e.target.value)}
              minLength={8}
              required
            />
          </div>

          <button
            id="btn-login-submit"
            className="btn btn-primary w-full btn-lg"
            type="submit"
            disabled={loading}
            style={{ justifyContent: 'center', marginTop: '8px' }}
          >
            {loading ? (
              <div className="spinner" style={{ borderTopColor: 'white' }}></div>
            ) : isRegister ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-toggle">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => setIsRegister(!isRegister)} id="btn-toggle-auth">
            {isRegister ? 'Sign In' : 'Create one'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
