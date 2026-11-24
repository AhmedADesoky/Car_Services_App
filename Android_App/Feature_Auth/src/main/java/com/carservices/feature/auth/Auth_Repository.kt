package com.carservices.feature.auth

import android.os.Build
import com.carservices.core.network.ApiResult
import com.carservices.core.network.BindRequest
import com.carservices.core.network.Car_Services_Api
import com.carservices.core.network.LoginRequest
import com.carservices.core.network.LoginResponse
import com.carservices.core.network.MeResponse
import com.carservices.core.network.MfaEnableRequest
import com.carservices.core.network.MfaSetupResponse
import com.carservices.core.network.MfaVerifyRequest
import com.carservices.core.network.PasswordChangeRequest
import com.carservices.core.network.Problem
import com.carservices.core.network.SessionResponse
import com.carservices.core.network.SetupNeeds
import com.carservices.core.network.apiCall
import com.carservices.core.security.SessionStore

/** Where sign-in stands after a step. */
sealed interface SignInStep {
    /** Full session saved on the phone. */
    data class SignedIn(val user: MeResponse) : SignInStep
    /** Password was right; the 6-digit code is next. */
    data class NeedsCode(val mfaToken: String, val user: MeResponse) : SignInStep
    /** New account: change password and/or turn on 2-step verification first (screen S2). */
    data class NeedsSetup(val setup: SetupNeeds, val user: MeResponse) : SignInStep
}

/**
 * Repository layer: talks to the API and keeps the device session in sync.
 * The restricted set-up token is kept in memory only (never written to the phone).
 */
class AuthRepository(
    private val api: Car_Services_Api,
    private val sessions: SessionStore,
    private val appVersion: String,
) {
    private var setupToken: String? = null
    private var setupUser: MeResponse? = null
    var setupNeeds: SetupNeeds? = null
        private set
    val pendingUser: MeResponse? get() = setupUser

    suspend fun bindDevice(stationCode: String): ApiResult<Unit> {
        val result = apiCall {
            api.bind(BindRequest(stationCode = stationCode.trim().uppercase(), model = Build.MODEL, osVersion = Build.VERSION.RELEASE, appVersion = appVersion))
        }
        if (result is ApiResult.Success) {
            sessions.saveBinding(result.value.stationCode, result.value.stationName, result.value.deviceId)
        }
        return result.map { }
    }

    suspend fun login(username: String, password: String): ApiResult<SignInStep> {
        val session = sessions.current()
        val stationCode = session.stationCode ?: return ApiResult.Failure(Problem("DEVICE_NOT_BOUND"))
        val deviceId = session.deviceId ?: return ApiResult.Failure(Problem("DEVICE_NOT_BOUND"))
        return apiCall { api.login(LoginRequest(stationCode, deviceId, username.trim(), password)) }.andThen { handle(it) }
    }

    /** 6-digit authenticator code, or a recovery code like ABCD-EF23. */
    suspend fun verifyCode(mfaToken: String, code: String): ApiResult<SignInStep> =
        apiCall { api.verifyMfa(MfaVerifyRequest(mfaToken, code.trim())) }.andThen { handle(it) }

    /** S2 step 1. */
    suspend fun changePassword(current: String, new: String): ApiResult<SetupNeeds?> {
        val token = setupToken ?: return ApiResult.Failure(Problem("SETUP_EXPIRED"))
        return apiCall { api.changePassword("Bearer $token", PasswordChangeRequest(current, new)) }.andThen { applySession(it) }
    }

    /** S2 step 2a: secret + otpauth:// link for the authenticator app. */
    suspend fun startTwoStep(): ApiResult<MfaSetupResponse> {
        val token = setupToken ?: return ApiResult.Failure(Problem("SETUP_EXPIRED"))
        return apiCall { api.startMfaSetup("Bearer $token") }
    }

    /** S2 step 2b: confirm with the first code -> recovery codes (shown once). */
    suspend fun enableTwoStep(code: String): ApiResult<List<String>> {
        val token = setupToken ?: return ApiResult.Failure(Problem("SETUP_EXPIRED"))
        return apiCall { api.enableMfa("Bearer $token", MfaEnableRequest(code.trim())) }.andThen { resp ->
            applySession(resp).map { resp.recoveryCodes }
        }
    }

    /** Sign out on this phone: the server ends the session, then the phone forgets the tokens. */
    suspend fun logout() {
        apiCall { api.logout() }
        sessions.signOut()
    }

    fun cancelSetup() { setupToken = null; setupUser = null; setupNeeds = null }

    suspend fun changeStation() = sessions.unbind()

    suspend fun setLanguage(code: String) = sessions.setLanguage(code)

    private suspend fun handle(resp: LoginResponse): ApiResult<SignInStep> {
        val access = resp.accessToken
        return when {
            resp.mfaRequired && resp.mfaToken != null -> ApiResult.Success(SignInStep.NeedsCode(resp.mfaToken!!, resp.user))
            resp.setup != null && access != null -> {
                setupToken = access; setupUser = resp.user; setupNeeds = resp.setup
                ApiResult.Success(SignInStep.NeedsSetup(resp.setup!!, resp.user))
            }
            access != null && resp.refreshToken != null -> {
                sessions.saveTokens(access, resp.refreshToken!!, resp.user.displayName)
                cancelSetup()
                ApiResult.Success(SignInStep.SignedIn(resp.user))
            }
            else -> ApiResult.Failure(Problem("UNEXPECTED_RESPONSE"))
        }
    }

    /** After a set-up step: either more set-up (new restricted token) or the full session is saved. */
    private suspend fun applySession(resp: SessionResponse): ApiResult<SetupNeeds?> {
        val refresh = resp.refreshToken
        return if (resp.setup == null && refresh != null) {
            sessions.saveTokens(resp.accessToken, refresh, setupUser?.displayName)
            cancelSetup()
            ApiResult.Success(null)
        } else {
            setupToken = resp.accessToken
            setupNeeds = resp.setup
            ApiResult.Success(resp.setup)
        }
    }
}

private inline fun <T, R> ApiResult<T>.map(transform: (T) -> R): ApiResult<R> = when (this) {
    is ApiResult.Success -> ApiResult.Success(transform(value))
    is ApiResult.Failure -> this
    ApiResult.NetworkError -> ApiResult.NetworkError
}

private inline fun <T, R> ApiResult<T>.andThen(next: (T) -> ApiResult<R>): ApiResult<R> = when (this) {
    is ApiResult.Success -> next(value)
    is ApiResult.Failure -> this
    ApiResult.NetworkError -> ApiResult.NetworkError
}
