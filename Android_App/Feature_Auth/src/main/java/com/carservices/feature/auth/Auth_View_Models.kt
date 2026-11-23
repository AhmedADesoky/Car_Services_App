package com.carservices.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.carservices.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class BindUiState(
    val stationCode: String = "",
    val loading: Boolean = false,
    val errorCode: String? = null,
    val bound: Boolean = false,
)

/** Screen S1 - station code binding. */
class BindViewModel(private val repository: AuthRepository) : ViewModel() {
    private val _state = MutableStateFlow(BindUiState())
    val state: StateFlow<BindUiState> = _state.asStateFlow()

    fun onCodeChange(value: String) = _state.update { it.copy(stationCode = value.take(12), errorCode = null) }

    fun bind() {
        val code = _state.value.stationCode
        if (code.trim().length < 4) {
            _state.update { it.copy(errorCode = "VALIDATION_FAILED") }
            return
        }
        _state.update { it.copy(loading = true, errorCode = null) }
        viewModelScope.launch {
            when (val result = repository.bindDevice(code)) {
                is ApiResult.Success -> _state.update { it.copy(loading = false, bound = true) }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, errorCode = result.problem.code) }
                ApiResult.NetworkError -> _state.update { it.copy(loading = false, errorCode = "NETWORK") }
            }
        }
    }

    fun setLanguage(code: String) = viewModelScope.launch { repository.setLanguage(code) }
}

data class LoginUiState(
    val username: String = "",
    val password: String = "",
    val loading: Boolean = false,
    val errorCode: String? = null,
    val signedIn: Boolean = false,
)

/** Screen 01 - Sign in. */
class LoginViewModel(private val repository: AuthRepository) : ViewModel() {
    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun onUsernameChange(value: String) = _state.update { it.copy(username = value, errorCode = null) }
    fun onPasswordChange(value: String) = _state.update { it.copy(password = value, errorCode = null) }

    fun signIn() {
        val s = _state.value
        if (s.username.isBlank() || s.password.isBlank()) {
            _state.update { it.copy(errorCode = "VALIDATION_FAILED") }
            return
        }
        _state.update { it.copy(loading = true, errorCode = null) }
        viewModelScope.launch {
            when (val result = repository.login(s.username, s.password)) {
                is ApiResult.Success -> _state.update { it.copy(loading = false, signedIn = true, password = "") }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, errorCode = result.problem.code) }
                ApiResult.NetworkError -> _state.update { it.copy(loading = false, errorCode = "NETWORK") }
            }
        }
    }

    fun changeStation() = viewModelScope.launch { repository.changeStation() }
    fun setLanguage(code: String) = viewModelScope.launch { repository.setLanguage(code) }
}

/** Maps backend problem codes to readable text in both languages. */
internal fun errorText(code: String?, arabic: Boolean): String? = when (code) {
    null -> null
    "NETWORK" -> if (arabic) "تعذّر الوصول إلى الخادم. تحقق من الشبكة وتشغيل الخادم." else "Cannot reach the server. Check Wi-Fi and that the backend is running."
    "STATION_NOT_FOUND" -> if (arabic) "كود المحطة غير صحيح." else "Station code not found."
    "STATION_SUSPENDED" -> if (arabic) "هذه المحطة موقوفة." else "This station is suspended."
    "INVALID_CREDENTIALS" -> if (arabic) "اسم المستخدم أو كلمة المرور غير صحيحة." else "Username or password is incorrect."
    "ACCOUNT_LOCKED" -> if (arabic) "محاولات كثيرة. حاول بعد 15 دقيقة." else "Too many attempts. Try again in 15 minutes."
    "DEVICE_NOT_BOUND" -> if (arabic) "هذا الهاتف غير مربوط بالمحطة." else "This phone is not bound to the station."
    "VALIDATION_FAILED" -> if (arabic) "أكمل الحقول المطلوبة." else "Please fill in the required fields."
    else -> if (arabic) "حدث خطأ ($code)." else "Something went wrong ($code)."
}
