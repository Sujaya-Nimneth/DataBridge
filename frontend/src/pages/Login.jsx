/**
 * Sign in / Create account. Built from the Astryx login page template: a
 * minimal centred credential card. The first screen says plainly what this is
 * and what to do; errors appear beside the field they belong to.
 *
 * Keeps the tested contract: exact field labels, the submit button id/label,
 * the "Create one" toggle and focus-to-first-error on a validation failure.
 */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Card } from '@astryxdesign/core/Card';
import { Heading, Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/Stack';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Button } from '@astryxdesign/core/Button';
import { Banner } from '@astryxdesign/core/Banner';

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
      <Card className="login-card" padding={6}>
        <main>
          <VStack gap={2}>
            <div className="login-logo" aria-hidden="true">
              D
            </div>
            <Heading level={1}>
              {isRegister ? 'Create your account' : 'Sign in to DataBridge'}
            </Heading>
            <Text color="secondary">
              {isRegister
                ? 'Connect your databases and start moving data.'
                : 'Connect to your databases, explore schemas, and run transfers.'}
            </Text>
          </VStack>

          <form
            onSubmit={handleSubmit}
            aria-label={isRegister ? 'Registration form' : 'Sign-in form'}
            noValidate
          >
            <VStack gap={4}>
              {serverError && (
                <Banner
                  status="error"
                  role="alert"
                  title={serverError}
                  collapsible={false}
                  container="card"
                />
              )}

              {isRegister && (
                <TextInput
                  id="input-fullname"
                  label="Full Name"
                  type="text"
                  placeholder="Alex Kim"
                  autoComplete="name"
                  hasSpellCheck={false}
                  value={form.fullName}
                  onChange={(value) => updateForm('fullName', value)}
                />
              )}

              <TextInput
                id="input-email"
                label="Email Address"
                type="email"
                placeholder="operator@databridge.local"
                autoComplete="email"
                hasSpellCheck={false}
                value={form.email}
                onChange={(value) => updateForm('email', value)}
              />

              <TextInput
                id="input-password"
                label="Password"
                type="password"
                placeholder="••••••••"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={form.password}
                onChange={(value) => updateForm('password', value)}
                description={isRegister ? 'At least 8 characters.' : undefined}
              />

              {isRegister && (
                <TextInput
                  id="input-confirm-password"
                  label="Confirm Password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(value) => updateForm('confirmPassword', value)}
                  status={
                    fieldError?.field === 'confirmPassword'
                      ? { type: 'error', message: fieldError.message }
                      : undefined
                  }
                />
              )}

              <Button
                id="btn-login-submit"
                label={isRegister ? 'Create Account' : 'Sign In'}
                variant="primary"
                type="submit"
                width="100%"
                isLoading={loading}
              />
            </VStack>
          </form>

          <div className="login-toggle">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button type="button" onClick={toggleMode} id="btn-toggle-auth">
              {isRegister ? 'Sign In' : 'Create one'}
            </button>
          </div>
        </main>
      </Card>
    </div>
  );
}

export default Login;
