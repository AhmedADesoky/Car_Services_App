package com.carservices.core.network

import retrofit2.http.Body
import retrofit2.http.GET
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
}

/** Separate interface for the refresh call so the authenticator never recurses into itself. */
interface Refresh_Api {
    @POST("auth/refresh")
    fun refresh(@Body body: RefreshRequest): retrofit2.Call<TokenPair>
}
