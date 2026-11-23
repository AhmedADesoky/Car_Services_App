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
    val serverOk: Boolean = false,
    val databaseOk: Boolean = false,
)

/** 02 - Worker home shell. Proves the full chain: app -> backend -> Supabase. */
class HomeViewModel(private val api: Car_Services_Api, private val sessions: SessionStore) : ViewModel() {
    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true) }
        viewModelScope.launch {
            val health = apiCall { api.health() }
            val me = apiCall { api.me() }
            _state.update {
                it.copy(
                    loading = false,
                    serverOk = health is ApiResult.Success,
                    databaseOk = (health as? ApiResult.Success)?.value?.db == "up",
                    me = (me as? ApiResult.Success)?.value,
                )
            }
        }
    }

    fun signOut(onDone: () -> Unit) = viewModelScope.launch {
        sessions.signOut()
        onDone()
    }
}
