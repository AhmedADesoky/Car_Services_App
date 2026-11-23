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

@Serializable
data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Int,
    val mustChangePassword: Boolean = false,
    val user: MeResponse,
)

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
