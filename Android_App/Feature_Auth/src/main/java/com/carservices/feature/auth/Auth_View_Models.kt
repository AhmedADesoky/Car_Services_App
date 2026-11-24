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
    val code: String = "",
    val mfaToken: String? = null,       // set -> show the 6-digit code step
    val loading: Boolean = false,
    val errorCode: String? = null,
    val signedIn: Boolean = false,
    val needsSetup: Boolean = false,    // -> screen S2 (change password / 2-step set-up)
)

/** Screen 01 - Sign in, with the 2-step verification code step. */
class LoginViewModel(private val repository: AuthRepository) : ViewModel() {
    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun onUsernameChange(value: String) = _state.update { it.copy(username = value, errorCode = null) }
    fun onPasswordChange(value: String) = _state.update { it.copy(password = value, errorCode = null) }
    fun onCodeChange(value: String) = _state.update { it.copy(code = value.uppercase().filter { c -> c.isLetterOrDigit() || c == '-' }.take(9), errorCode = null) }

    fun signIn() {
        val s = _state.value
        if (s.username.isBlank() || s.password.isBlank()) {
            _state.update { it.copy(errorCode = "VALIDATION_FAILED") }
            return
        }
        runStep { repository.login(s.username, s.password) }
    }

    fun verifyCode() {
        val s = _state.value
        val token = s.mfaToken ?: return
        if (s.code.length < 6) { _state.update { it.copy(errorCode = "VALIDATION_FAILED") }; return }
        runStep { repository.verifyCode(token, s.code) }
    }

    /** Back from the code step to username + password. */
    fun cancelCode() = _state.update { it.copy(mfaToken = null, code = "", errorCode = null, password = "") }

    fun setupHandled() = _state.update { it.copy(needsSetup = false) }

    private fun runStep(call: suspend () -> ApiResult<SignInStep>) {
        _state.update { it.copy(loading = true, errorCode = null) }
        viewModelScope.launch {
            when (val result = call()) {
                is ApiResult.Success -> when (val step = result.value) {
                    is SignInStep.SignedIn -> _state.update { it.copy(loading = false, signedIn = true, password = "", code = "", mfaToken = null) }
                    is SignInStep.NeedsCode -> _state.update { it.copy(loading = false, mfaToken = step.mfaToken, code = "") }
                    is SignInStep.NeedsSetup -> _state.update { it.copy(loading = false, needsSetup = true, password = "", code = "", mfaToken = null) }
                }
                is ApiResult.Failure -> _state.update {
                    // an expired 2FA challenge sends the person back to the password step
                    if (result.problem.code == "MFA_EXPIRED") it.copy(loading = false, errorCode = "MFA_EXPIRED", mfaToken = null, code = "", password = "")
                    else it.copy(loading = false, errorCode = result.problem.code, code = if (it.mfaToken != null) "" else it.code)
                }
                ApiResult.NetworkError -> _state.update { it.copy(loading = false, errorCode = "NETWORK") }
            }
        }
    }

    fun changeStation() = viewModelScope.launch { repository.changeStation() }
    fun setLanguage(code: String) = viewModelScope.launch { repository.setLanguage(code) }
}

enum class SetupStep { Password, TwoStepIntro, TwoStepCode, RecoveryCodes, Done }

data class SetupUiState(
    val step: SetupStep = SetupStep.Password,
    val currentPassword: String = "",
    val newPassword: String = "",
    val confirmPassword: String = "",
    val secret: String? = null,
    val otpauthUri: String? = null,
    val code: String = "",
    val recoveryCodes: List<String> = emptyList(),
    val savedCodes: Boolean = false,
    val loading: Boolean = false,
    val errorCode: String? = null,
)

/** Screen S2 - first sign-in set-up: new password, then 2-step verification with recovery codes. */
class SetupViewModel(private val repository: AuthRepository) : ViewModel() {
    private val needs = repository.setupNeeds
    private val _state = MutableStateFlow(SetupUiState(step = if (needs?.password == true) SetupStep.Password else SetupStep.TwoStepIntro))
    val state: StateFlow<SetupUiState> = _state.asStateFlow()

    val username: String = repository.pendingUser?.username ?: ""
    val displayName: String = repository.pendingUser?.displayName ?: ""
    val minLength: Int = if (repository.pendingUser?.roles?.any { it == "owner" || it == "accountant" } == true) 10 else 8
    val needsTwoStep: Boolean = needs?.mfa == true
    val hadPasswordStep: Boolean = needs?.password == true
    val expired: Boolean = needs == null

    fun onCurrent(v: String) = _state.update { it.copy(currentPassword = v, errorCode = null) }
    fun onNew(v: String) = _state.update { it.copy(newPassword = v, errorCode = null) }
    fun onConfirm(v: String) = _state.update { it.copy(confirmPassword = v, errorCode = null) }
    fun onCode(v: String) = _state.update { it.copy(code = v.filter(Char::isDigit).take(6), errorCode = null) }
    fun onSavedCodes(v: Boolean) = _state.update { it.copy(savedCodes = v) }

    fun savePassword() {
        val s = _state.value
        if (s.newPassword != s.confirmPassword) { _state.update { it.copy(errorCode = "PASSWORD_MISMATCH") }; return }
        _state.update { it.copy(loading = true, errorCode = null) }
        viewModelScope.launch {
            when (val r = repository.changePassword(s.currentPassword, s.newPassword)) {
                is ApiResult.Success -> _state.update {
                    it.copy(loading = false, currentPassword = "", newPassword = "", confirmPassword = "",
                        step = if (r.value?.mfa == true) SetupStep.TwoStepIntro else SetupStep.Done)
                }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, errorCode = r.problem.code) }
                ApiResult.NetworkError -> _state.update { it.copy(loading = false, errorCode = "NETWORK") }
            }
        }
    }

    fun startTwoStep() {
        _state.update { it.copy(loading = true, errorCode = null) }
        viewModelScope.launch {
            when (val r = repository.startTwoStep()) {
                is ApiResult.Success -> _state.update { it.copy(loading = false, secret = r.value.secret, otpauthUri = r.value.otpauthUri, step = SetupStep.TwoStepCode) }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, errorCode = r.problem.code) }
                ApiResult.NetworkError -> _state.update { it.copy(loading = false, errorCode = "NETWORK") }
            }
        }
    }

    fun enableTwoStep() {
        val code = _state.value.code
        if (code.length != 6) { _state.update { it.copy(errorCode = "VALIDATION_FAILED") }; return }
        _state.update { it.copy(loading = true, errorCode = null) }
        viewModelScope.launch {
            when (val r = repository.enableTwoStep(code)) {
                is ApiResult.Success -> _state.update { it.copy(loading = false, recoveryCodes = r.value, code = "", step = SetupStep.RecoveryCodes) }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, errorCode = r.problem.code, code = "") }
                ApiResult.NetworkError -> _state.update { it.copy(loading = false, errorCode = "NETWORK") }
            }
        }
    }

    fun finish() = _state.update { it.copy(step = SetupStep.Done, recoveryCodes = emptyList()) }
    fun cancel() = repository.cancelSetup()
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
    "MFA_INVALID" -> if (arabic) "الرمز غير صحيح. استخدم الرمز الحالي من تطبيق المصادقة." else "That code is not correct. Use the current code from your authenticator app."
    "MFA_EXPIRED", "SETUP_EXPIRED", "TOKEN_STALE" -> if (arabic) "انتهت المهلة. سجّل الدخول مرة أخرى." else "This step timed out. Please sign in again."
    "PASSWORD_POLICY" -> if (arabic) "كلمة المرور لا تطابق الشروط بالأسفل." else "The new password does not meet the rules below."
    "PASSWORD_MISMATCH" -> if (arabic) "كلمتا المرور غير متطابقتين." else "The two passwords do not match."
    "SIGNED_OUT" -> if (arabic) "تم تسجيل خروجك من هذا الهاتف." else "You were signed out on this phone."
    else -> if (arabic) "حدث خطأ ($code)." else "Something went wrong ($code)."
}
