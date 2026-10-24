import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import type { User } from '@/types'

export interface PasskeyInfo {
  id: string
  deviceName: string
  deviceType: string
  backedUp: boolean | number
  createdAt: string
  lastUsedAt: string | null
}

export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined' && browserSupportsWebAuthn()
}

/**
 * Register a new passkey for the current logged-in user
 */
export async function registerPasskey(token: string, deviceName: string): Promise<PasskeyInfo> {
  // 1. Get registration options from server
  const optsRes = await fetch('/api/auth/passkey/register-options', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!optsRes.ok) {
    const err = await optsRes.json()
    throw new Error(err.error || 'Failed to start passkey registration')
  }

  const { options, challengeId } = await optsRes.json()

  // 2. Trigger browser passkey creation modal (Touch ID, Face ID, etc.)
  const registrationResponse = await startRegistration({ optionsJSON: options })

  // 3. Verify response on server
  const verifyRes = await fetch('/api/auth/passkey/register-verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      response: registrationResponse,
      challengeId,
      deviceName: deviceName.trim(),
    }),
  })

  const verifyData = await verifyRes.json()
  if (!verifyRes.ok) {
    throw new Error(verifyData.error || 'Failed to verify passkey')
  }

  return verifyData.passkey
}

/**
 * Authenticate with a passkey and receive session token + user
 */
export async function loginWithPasskey(username?: string): Promise<{ token: string; user: User }> {
  // 1. Get authentication options from server
  const optsRes = await fetch('/api/auth/passkey/login-options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username?.trim() || undefined }),
  })

  if (!optsRes.ok) {
    const err = await optsRes.json()
    throw new Error(err.error || 'Failed to start passkey authentication')
  }

  const { options, challengeId } = await optsRes.json()

  // 2. Trigger browser passkey prompt
  const authResponse = await startAuthentication({ optionsJSON: options })

  // 3. Verify response on server
  const verifyRes = await fetch('/api/auth/passkey/login-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      response: authResponse,
      challengeId,
    }),
  })

  const verifyData = await verifyRes.json()
  if (!verifyRes.ok) {
    throw new Error(verifyData.error || 'Passkey authentication failed')
  }

  return {
    token: verifyData.token,
    user: verifyData.user,
  }
}

/**
 * Fetch all registered passkeys for the current user
 */
export async function fetchUserPasskeys(token: string): Promise<PasskeyInfo[]> {
  const res = await fetch('/api/auth/passkeys', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to fetch passkeys')
  }

  const data = await res.json()
  return data.passkeys || []
}

/**
 * Delete a passkey
 */
export async function deletePasskey(token: string, id: string): Promise<void> {
  const res = await fetch(`/api/auth/passkeys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to delete passkey')
  }
}

