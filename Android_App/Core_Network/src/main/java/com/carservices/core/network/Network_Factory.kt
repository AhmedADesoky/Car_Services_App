package com.carservices.core.network

import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

/** Builds the OkHttp + Retrofit stack that connects the app to the backend. */
object NetworkFactory {

    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true   // send fields that have default values, e.g. platform = "android"
    }

    fun create(baseUrl: String, tokens: TokenProvider, appVersion: String, debug: Boolean): Car_Services_Api {
        val refreshClient = baseClient(debug)
            .addInterceptor(LocaleInterceptor(tokens, appVersion))
            .build()
        val refreshApi by lazy { retrofit(baseUrl, refreshClient).create(Refresh_Api::class.java) }

        val client = baseClient(debug)
            .addInterceptor(LocaleInterceptor(tokens, appVersion))
            .addInterceptor(IdempotencyInterceptor())
            .addInterceptor(AuthInterceptor(tokens))
            .authenticator(TokenAuthenticator(tokens) { refreshApi })
            // TODO(P10): certificate pinning for the production host (spec section 3.4)
            .build()
        return retrofit(baseUrl, client).create(Car_Services_Api::class.java)
    }

    private fun baseClient(debug: Boolean) = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .apply {
            if (debug) {
                // BASIC only: never log bodies (passwords, tokens, customer data)
                addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
            }
        }

    private fun retrofit(baseUrl: String, client: OkHttpClient) = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
}
