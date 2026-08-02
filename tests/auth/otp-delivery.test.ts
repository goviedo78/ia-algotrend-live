import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deliverEmailOtp,
  OtpDeliveryError,
} from '../../src/lib/auth/otp-delivery'

test('generates and sends the same six-digit OTP', async () => {
  const calls: Array<{ email: string; token: string }> = []

  await deliverEmailOtp('user@example.com', {
    generateOtp: async (email) => {
      assert.equal(email, 'user@example.com')
      return '123456'
    },
    sendOtp: async (email, token) => {
      calls.push({ email, token })
    },
  })

  assert.deepEqual(calls, [{ email: 'user@example.com', token: '123456' }])
})

test('does not send malformed OTPs', async () => {
  let sendCalled = false

  await assert.rejects(
    deliverEmailOtp('user@example.com', {
      generateOtp: async () => 'not-a-code',
      sendOtp: async () => {
        sendCalled = true
      },
    }),
    (error) => error instanceof OtpDeliveryError && error.code === 'OTP_GENERATION_FAILED',
  )

  assert.equal(sendCalled, false)
})

test('preserves a provider delivery failure', async () => {
  await assert.rejects(
    deliverEmailOtp('user@example.com', {
      generateOtp: async () => '654321',
      sendOtp: async () => {
        throw new OtpDeliveryError('EMAIL_DELIVERY_FAILED', 422)
      },
    }),
    (error) => (
      error instanceof OtpDeliveryError
      && error.code === 'EMAIL_DELIVERY_FAILED'
      && error.providerStatus === 422
    ),
  )
})
