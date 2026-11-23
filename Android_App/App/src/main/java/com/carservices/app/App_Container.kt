package com.carservices.app

import android.content.Context
import com.carservices.core.network.Car_Services_Api
import com.carservices.core.network.NetworkFactory
import com.carservices.core.network.TokenProvider
import com.carservices.core.security.SessionStore
import com.carservices.feature.auth.AuthRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

/**
 * Manual dependency container (one per app). Replace with Hilt modules once KSP fully supports
 * AGP 9's built-in Kotlin - the constructors are already DI-friendly.
 */
class AppContainer(context: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val sessions = SessionStore(context.applicationContext)

    private val tokenProvider = object : TokenProvider {
        override fun accessToken() = sessions.currentBlocking().accessToken
        override fun refreshToken() = sessions.currentBlocking().refreshToken
        override fun language() = sessions.currentBlocking().language
        override fun onTokensRefreshed(accessToken: String, refreshToken: String) =
            runBlocking { sessions.saveTokens(accessToken, refreshToken) }
        override fun onSessionExpired() { scope.launch { sessions.signOut() } }
    }

    val api: Car_Services_Api = NetworkFactory.create(
        baseUrl = BuildConfig.BASE_URL,
        tokens = tokenProvider,
        appVersion = BuildConfig.VERSION_NAME,
        debug = BuildConfig.DEBUG,
    )

    val authRepository = AuthRepository(api, sessions, BuildConfig.VERSION_NAME)
}
