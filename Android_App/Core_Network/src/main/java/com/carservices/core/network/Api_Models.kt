package com.carservices.core.network

import kotlinx.serialization.Serializable

// DTOs mirror Api_Contract/Open_Api.yaml. Later these are generated with OpenAPI Generator.

@Serializable
data class HealthResponse(val status: String, val db: String, val time: String? = null)

@Serializable
data class BindRequest(
    val stationCode: String,
    val platform: String = "android",
    val model: String? = null,
    val osVersion: String? = null,
    val appVersion: String? = null,
)

@Serializable
data class BindResponse(val deviceId: String, val stationCode: String, val stationName: String, val defaultLocale: String)

@Serializable
data class LoginRequest(val stationCode: String, val deviceId: String, val username: String, val password: String)

/**
 * Sign-in result. One of three shapes:
 *  - mfaRequired = true  -> mfaToken set, no tokens: ask for the 6-digit code (POST auth/mfa/verify)
 *  - setup != null       -> restricted accessToken, refreshToken = null: finish set-up first (screen S2)
 *  - otherwise           -> full session (accessToken + refreshToken)
 */
@Serializable
data class LoginResponse(
    val accessToken: String? = null,
    val refreshToken: String? = null,
    val expiresIn: Int = 0,
    val mustChangePassword: Boolean = false,
    val mfaRequired: Boolean = false,
    val mfaToken: String? = null,
    val setup: SetupNeeds? = null,
    val recoveryCodeUsed: Boolean = false,
    val user: MeResponse,
)

/** What a new account must still do before it gets a full session. */
@Serializable
data class SetupNeeds(val password: Boolean = false, val mfa: Boolean = false)

/** Session part returned by password change / 2FA enable. */
@Serializable
data class SessionResponse(
    val accessToken: String,
    val refreshToken: String? = null,
    val expiresIn: Int = 0,
    val setup: SetupNeeds? = null,
    val recoveryCodes: List<String> = emptyList(),
)

@Serializable
data class MfaVerifyRequest(val mfaToken: String, val code: String)

@Serializable
data class PasswordChangeRequest(val currentPassword: String, val newPassword: String)

@Serializable
data class MfaSetupResponse(val secret: String, val otpauthUri: String)

@Serializable
data class MfaEnableRequest(val code: String)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
data class TokenPair(val accessToken: String, val refreshToken: String, val expiresIn: Int)

@Serializable
data class MeResponse(
    val id: String,
    val username: String,
    val displayName: String,
    val roles: List<String> = emptyList(),
    val stationName: String,
    val locale: String = "en",
)

/** RFC 9457 problem+json returned by the backend for every error. */
@Serializable
data class Problem(val code: String = "UNKNOWN", val detail: String? = null, val status: Int = 0)
