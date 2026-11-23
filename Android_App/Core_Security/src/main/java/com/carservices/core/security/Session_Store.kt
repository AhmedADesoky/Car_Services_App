package com.carservices.core.security

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking

private val Context.sessionDataStore by preferencesDataStore(name = "car_services_session")

/** What the app knows about this device: its station binding, the signed-in user, the language. */
data class Session(
    val stationCode: String? = null,
    val stationName: String? = null,
    val deviceId: String? = null,
    val accessToken: String? = null,
    val refreshToken: String? = null,
    val language: String = "en",
    val displayName: String? = null,
) {
    val isBound: Boolean get() = stationCode != null && deviceId != null
    val isSignedIn: Boolean get() = isBound && accessToken != null
}

/**
 * Device binding + tokens. A device belongs to ONE station (spec section 3.1);
 * unbinding wipes everything and destroys the Keystore key.
 */
class SessionStore(private val context: Context, private val cipher: KeystoreCipher = KeystoreCipher()) {

    val session: Flow<Session> = context.sessionDataStore.data.map { it.toSession() }

    suspend fun current(): Session = session.first()

    /** Synchronous read for OkHttp interceptors (they run on a background thread). */
    fun currentBlocking(): Session = runBlocking { current() }

    suspend fun saveBinding(stationCode: String, stationName: String, deviceId: String) {
        context.sessionDataStore.edit {
            it[STATION_CODE] = stationCode
            it[STATION_NAME] = stationName
            it[DEVICE_ID] = deviceId
        }
    }

    suspend fun saveTokens(accessToken: String, refreshToken: String, displayName: String? = null) {
        context.sessionDataStore.edit {
            it[ACCESS] = cipher.encrypt(accessToken)
            it[REFRESH] = cipher.encrypt(refreshToken)
            if (displayName != null) it[DISPLAY_NAME] = displayName
        }
    }

    suspend fun setLanguage(code: String) {
        context.sessionDataStore.edit { it[LANGUAGE] = code }
    }

    /** Logout: tokens go, the station binding stays. */
    suspend fun signOut() {
        context.sessionDataStore.edit {
            it.remove(ACCESS)
            it.remove(REFRESH)
            it.remove(DISPLAY_NAME)
        }
    }

    /** "Change station": wipe this tenant's data from the phone completely. */
    suspend fun unbind() {
        context.sessionDataStore.edit { prefs ->
            val language = prefs[LANGUAGE]
            prefs.clear()
            if (language != null) prefs[LANGUAGE] = language
        }
        cipher.destroyKey()
    }

    private fun Preferences.toSession() = Session(
        stationCode = this[STATION_CODE],
        stationName = this[STATION_NAME],
        deviceId = this[DEVICE_ID],
        accessToken = this[ACCESS]?.let(cipher::decrypt),
        refreshToken = this[REFRESH]?.let(cipher::decrypt),
        language = this[LANGUAGE] ?: "en",
        displayName = this[DISPLAY_NAME],
    )

    private companion object {
        val STATION_CODE = stringPreferencesKey("station_code")
        val STATION_NAME = stringPreferencesKey("station_name")
        val DEVICE_ID = stringPreferencesKey("device_id")
        val ACCESS = stringPreferencesKey("access_token_enc")
        val REFRESH = stringPreferencesKey("refresh_token_enc")
        val LANGUAGE = stringPreferencesKey("language")
        val DISPLAY_NAME = stringPreferencesKey("display_name")
    }
}
