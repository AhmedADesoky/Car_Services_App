package com.carservices.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.carservices.core.network.ApiResult
import com.carservices.core.network.Car_Services_Api
import com.carservices.core.network.MeResponse
import com.carservices.core.network.apiCall
import com.carservices.core.security.SessionStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeUiState(
    val loading: Boolean = true,
    val me: MeResponse? = null,
)

/** 02 - Worker home. Loads the signed-in user; orders, stats and check-in plug in during P4-P6. */
class HomeViewModel(private val api: Car_Services_Api, private val sessions: SessionStore) : ViewModel() {
    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true) }
        viewModelScope.launch {
            val me = apiCall { api.me() }
            _state.update { it.copy(loading = false, me = (me as? ApiResult.Success)?.value) }
        }
    }

    /** Sign out on this phone: the server ends the session at once, then the phone forgets the tokens. */
    fun signOut(onDone: () -> Unit) = viewModelScope.launch {
        apiCall { api.logout() }
        sessions.signOut()
        onDone()
    }
}
