package com.carservices.core.network

import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import java.util.UUID

/** Where the network layer reads and writes tokens (implemented by Core_Security's SessionStore in App). */
interface TokenProvider {
    fun accessToken(): String?
    fun refreshToken(): String?
    fun language(): String
    fun onTokensRefreshed(accessToken: String, refreshToken: String)
    fun onSessionExpired()
}

/** Adds Authorization: Bearer <access token>. */
class AuthInterceptor(private val tokens: TokenProvider) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokens.accessToken()
        val request = if (token != null && chain.request().header("Authorization") == null) {
            chain.request().newBuilder().header("Authorization", "Bearer $token").build()
        } else chain.request()
        return chain.proceed(request)
    }
}

/** Accept-Language + X-App-Version on every call (spec section 10). */
class LocaleInterceptor(private val tokens: TokenProvider, private val appVersion: String) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response = chain.proceed(
        chain.request().newBuilder()
            .header("Accept-Language", tokens.language())
            .header("X-App-Version", appVersion)
            .build(),
    )
}

/**
 * Idempotency-Key on every POST, so a retry after a bad network never creates a duplicate
 * order / payment / message (spec section 4.2). A caller can set its own key to retry safely.
 */
class IdempotencyInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.method != "POST" || request.header("Idempotency-Key") != null) return chain.proceed(request)
        return chain.proceed(request.newBuilder().header("Idempotency-Key", UUID.randomUUID().toString()).build())
    }
}

/** On 401, rotates the refresh token once and retries; otherwise signs the user out. */
class TokenAuthenticator(private val tokens: TokenProvider, private val refreshApi: () -> Refresh_Api) : Authenticator {
    @Synchronized
    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.request.url.encodedPath.endsWith("/auth/login")) return null
        if (responseCount(response) >= 2) return null

        val sentToken = response.request.header("Authorization")?.removePrefix("Bearer ")
        val current = tokens.accessToken()
        if (current != null && current != sentToken) {
            // Another request already refreshed while we waited
            return response.request.newBuilder().header("Authorization", "Bearer $current").build()
        }
        val refresh = tokens.refreshToken() ?: run { tokens.onSessionExpired(); return null }
        val result = runCatching { refreshApi().refresh(RefreshRequest(refresh)).execute() }.getOrNull()
        val pair = result?.takeIf { it.isSuccessful }?.body()
        if (pair == null) {
            tokens.onSessionExpired()
            return null
        }
        tokens.onTokensRefreshed(pair.accessToken, pair.refreshToken)
        return response.request.newBuilder().header("Authorization", "Bearer ${pair.accessToken}").build()
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) { count++; prior = prior.priorResponse }
        return count
    }
}
