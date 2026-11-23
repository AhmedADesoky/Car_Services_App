package com.carservices.feature.auth

import android.os.Build
import com.carservices.core.network.ApiResult
import com.carservices.core.network.BindRequest
import com.carservices.core.network.Car_Services_Api
import com.carservices.core.network.LoginRequest
import com.carservices.core.network.MeResponse
import com.carservices.core.network.apiCall
import com.carservices.core.security.SessionStore

/** Repository layer: talks to the API and keeps the device session in sync. */
class AuthRepository(
    private val api: Car_Services_Api,
    private val sessions: SessionStore,
    private val appVersion: String,
) {
    suspend fun bindDevice(stationCode: String): ApiResult<Unit> {
        val result = apiCall {
            api.bind(BindRequest(stationCode = stationCode.trim().uppercase(), model = Build.MODEL, osVersion = Build.VERSION.RELEASE, appVersion = appVersion))
        }
        if (result is ApiResult.Success) {
            sessions.saveBinding(result.value.stationCode, result.value.stationName, result.value.deviceId)
        }
        return result.map { }
    }

    suspend fun login(username: String, password: String): ApiResult<MeResponse> {
        val session = sessions.current()
        val stationCode = session.stationCode ?: return ApiResult.Failure(com.carservices.core.network.Problem("DEVICE_NOT_BOUND"))
        val deviceId = session.deviceId ?: return ApiResult.Failure(com.carservices.core.network.Problem("DEVICE_NOT_BOUND"))
        val result = apiCall { api.login(LoginRequest(stationCode, deviceId, username.trim(), password)) }
        if (result is ApiResult.Success) {
            sessions.saveTokens(result.value.accessToken, result.value.refreshToken, result.value.user.displayName)
        }
        return result.map { it.user }
    }

    suspend fun changeStation() = sessions.unbind()

    suspend fun setLanguage(code: String) = sessions.setLanguage(code)
}

private inline fun <T, R> ApiResult<T>.map(transform: (T) -> R): ApiResult<R> = when (this) {
    is ApiResult.Success -> ApiResult.Success(transform(value))
    is ApiResult.Failure -> this
    ApiResult.NetworkError -> ApiResult.NetworkError
}
