package com.carservices.core.network

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

/** Retrofit view of the Core API. Paths are relative to BuildConfig.BASE_URL (ends with /v1/). */
interface Car_Services_Api {
    @GET("health")
    suspend fun health(): HealthResponse

    @POST("devices/bind")
    suspend fun bind(@Body body: BindRequest): BindResponse

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @GET("auth/me")
    suspend fun me(): MeResponse

    /** Second sign-in step: 6-digit authenticator code or a recovery code. */
    @POST("auth/mfa/verify")
    suspend fun verifyMfa(@Body body: MfaVerifyRequest): LoginResponse

    // Set-up calls carry the restricted token explicitly (it is never stored on the phone).
    @POST("auth/password")
    suspend fun changePassword(@Header("Authorization") bearer: String, @Body body: PasswordChangeRequest): SessionResponse

    @POST("auth/mfa/setup")
    suspend fun startMfaSetup(@Header("Authorization") bearer: String): MfaSetupResponse

    @POST("auth/mfa/enable")
    suspend fun enableMfa(@Header("Authorization") bearer: String, @Body body: MfaEnableRequest): SessionResponse

    /** Sign out on this phone (the server ends the session at once). */
    @POST("auth/logout")
    suspend fun logout(): Unit
}

/** Separate interface for the refresh call so the authenticator never recurses into itself. */
interface Refresh_Api {
    @POST("auth/refresh")
    fun refresh(@Body body: RefreshRequest): retrofit2.Call<TokenPair>
}
