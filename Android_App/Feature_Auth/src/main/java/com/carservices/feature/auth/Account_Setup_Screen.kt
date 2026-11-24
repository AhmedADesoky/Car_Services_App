package com.carservices.feature.auth

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Pin
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.carservices.core.designsystem.AppLanguage
import com.carservices.core.designsystem.CarButton
import com.carservices.core.designsystem.CarColors
import com.carservices.core.designsystem.CarPage
import com.carservices.core.designsystem.FloatingActionBar
import com.carservices.core.designsystem.GhostButton
import com.carservices.core.designsystem.GlassCard
import com.carservices.core.designsystem.Glyph
import com.carservices.core.designsystem.LocalAppLanguage
import com.carservices.core.designsystem.MeterBar
import com.carservices.core.designsystem.SoftField
import com.carservices.core.designsystem.Stepper
import com.carservices.core.designsystem.l

/**
 * S2 - finish setting up a new account (first sign-in): choose a new password, then (owner, accountant)
 * turn on 2-step verification and save the recovery codes. Only after this does the phone get a full session.
 */
@Composable
fun AccountSetupScreen(viewModel: SetupViewModel, onDone: () -> Unit, onCancel: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val arabic = LocalAppLanguage.current == AppLanguage.Arabic
    LaunchedEffect(state.step) { if (state.step == SetupStep.Done) onDone() }
    LaunchedEffect(Unit) { if (viewModel.expired) onCancel() }
    val cancel = { viewModel.cancel(); onCancel() }
    BackHandler(enabled = state.step != SetupStep.RecoveryCodes) { cancel() }

    val steps = buildList {
        if (viewModel.hadPasswordStep) add(SetupStep.Password)
        if (viewModel.needsTwoStep) addAll(listOf(SetupStep.TwoStepIntro, SetupStep.TwoStepCode, SetupStep.RecoveryCodes))
    }

    CarPage(
        title = l("Set up your account", "إعداد حسابك"),
        subtitle = viewModel.displayName.ifBlank { null },
        onBack = if (state.step == SetupStep.RecoveryCodes) null else cancel,
        bottomBar = {
            FloatingActionBar {
                when (state.step) {
                    SetupStep.Password -> CarButton(l("Save password", "حفظ كلمة المرور"), viewModel::savePassword, icon = Icons.Outlined.Lock,
                        enabled = !state.loading && state.currentPassword.isNotEmpty() && state.newPassword.length >= viewModel.minLength && state.confirmPassword.isNotEmpty())
                    SetupStep.TwoStepIntro -> CarButton(l("Turn on 2-step verification", "تفعيل التحقق بخطوتين"), viewModel::startTwoStep, icon = Icons.Outlined.Shield, enabled = !state.loading)
                    SetupStep.TwoStepCode -> CarButton(l("Verify and turn on", "تحقق وفعّل"), viewModel::enableTwoStep, icon = Icons.Outlined.CheckCircle, enabled = !state.loading && state.code.length == 6)
                    SetupStep.RecoveryCodes -> CarButton(l("I saved them, continue", "حفظتها، متابعة"), viewModel::finish, enabled = state.savedCodes, tone = CarColors.Teal)
                    SetupStep.Done -> Unit
                }
            }
        },
    ) {
        item { Stepper(steps.size.coerceAtLeast(1), steps.indexOf(state.step).coerceAtLeast(0)) }
        item {
            AnimatedContent(state.step, transitionSpec = { (slideInHorizontally { it / 4 } + fadeIn()) togetherWith fadeOut() }, label = "setup") { step ->
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    when (step) {
                        SetupStep.Password -> PasswordStep(viewModel, state.currentPassword, state.newPassword, state.confirmPassword)
                        SetupStep.TwoStepIntro -> TwoStepIntro()
                        SetupStep.TwoStepCode -> TwoStepCode(viewModel, state)
                        SetupStep.RecoveryCodes -> RecoveryStep(viewModel, state)
                        SetupStep.Done -> Unit
                    }
                    errorText(state.errorCode, arabic)?.let { Text(it, color = CarColors.OrangeDark, style = MaterialTheme.typography.bodyMedium) }
                }
            }
        }
    }
}

@Composable
private fun PasswordStep(vm: SetupViewModel, current: String, new: String, confirm: String) {
    val name = vm.username.lowercase()
    val rules = listOf(
        l("At least ${vm.minLength} characters", "${vm.minLength} أحرف على الأقل") to (new.length >= vm.minLength),
        l("3 of: lower case, UPPER case, number, symbol", "٣ من: حروف صغيرة، كبيرة، أرقام، رموز") to
            (listOf(Regex("[a-z]"), Regex("[A-Z]"), Regex("[0-9]"), Regex("[^A-Za-z0-9]")).count { it.containsMatchIn(new) } >= 3),
        l("Does not contain your username", "لا يحتوي على اسم المستخدم") to (new.isNotEmpty() && (name.length < 3 || !new.lowercase().contains(name))),
        l("Both passwords match", "كلمتا المرور متطابقتان") to (new.isNotEmpty() && new == confirm),
    )
    Text(l("Choose your own password", "اختر كلمة مرور خاصة بك"), style = MaterialTheme.typography.headlineSmall, color = CarColors.Navy)
    Text(l("Replace the temporary password you were given. Your other phones will be signed out.", "استبدل كلمة المرور المؤقتة. سيتم تسجيل خروجك من الهواتف الأخرى."), color = CarColors.TextSecondary)
    SoftField(l("Current (temporary) password", "كلمة المرور الحالية (المؤقتة)"), current, vm::onCurrent, icon = Icons.Outlined.Key, isPassword = true)
    SoftField(l("New password", "كلمة المرور الجديدة"), new, vm::onNew, icon = Icons.Outlined.Lock, isPassword = true)
    SoftField(l("Confirm new password", "تأكيد كلمة المرور"), confirm, vm::onConfirm, icon = Icons.Outlined.Lock, isPassword = true)
    GlassCard(padding = 14.dp) {
        rules.forEach { (text, met) ->
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                Icon(Icons.Outlined.CheckCircle, null, tint = if (met) CarColors.Teal else CarColors.Divider, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(10.dp))
                Text(text, color = if (met) CarColors.NavyInk else CarColors.TextSecondary, style = MaterialTheme.typography.bodyMedium)
            }
        }
        Spacer(Modifier.height(8.dp))
        MeterBar(rules.count { it.second } / rules.size.toFloat())
    }
}

@Composable
private fun TwoStepIntro() {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Glyph(Icons.Outlined.Shield, size = 88.dp, active = true)
        Spacer(Modifier.height(16.dp))
        Text(l("Protect your station", "احمِ محطتك"), style = MaterialTheme.typography.headlineSmall, color = CarColors.Navy, textAlign = TextAlign.Center)
        Spacer(Modifier.height(6.dp))
        Text(l("Your account can see money and manage people, so signing in also needs a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator or Authy).",
            "حسابك يرى الأموال ويدير الأشخاص، لذلك يحتاج الدخول أيضاً رمزاً من ٦ أرقام من تطبيق مصادقة (Google Authenticator أو Microsoft Authenticator أو Authy)."),
            color = CarColors.TextSecondary, textAlign = TextAlign.Center)
    }
}

@Composable
private fun TwoStepCode(vm: SetupViewModel, state: SetupUiState) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    var noApp by remember { mutableStateOf(false) }
    Text(l("1. Add GarageOS to your authenticator", "١. أضف GarageOS إلى تطبيق المصادقة"), style = MaterialTheme.typography.titleMedium, color = CarColors.Navy)
    GhostButton(l("Open authenticator app", "افتح تطبيق المصادقة"), {
        try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(state.otpauthUri))) } catch (_: ActivityNotFoundException) { noApp = true }
    }, Modifier.fillMaxWidth(), icon = Icons.Outlined.OpenInNew, color = CarColors.Teal)
    if (noApp) Text(l("No authenticator app found. Install Google Authenticator, then come back, or type the key below by hand.",
        "لا يوجد تطبيق مصادقة. ثبّت Google Authenticator ثم عد، أو اكتب المفتاح بالأسفل يدوياً."), color = CarColors.OrangeDark, style = MaterialTheme.typography.bodyMedium)
    GlassCard(padding = 14.dp) {
        Text(l("Or type this key in the app", "أو اكتب هذا المفتاح في التطبيق"), color = CarColors.TextSecondary, style = MaterialTheme.typography.labelMedium)
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
            Text(state.secret.orEmpty().chunked(4).joinToString(" "), fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, color = CarColors.Navy, modifier = Modifier.weight(1f))
            GhostButton(l("Copy", "نسخ"), { clipboard.setText(AnnotatedString(state.secret.orEmpty())) }, icon = Icons.Outlined.ContentCopy)
        }
    }
    Text(l("2. Type the 6-digit code it shows", "٢. اكتب الرمز المكوّن من ٦ أرقام"), style = MaterialTheme.typography.titleMedium, color = CarColors.Navy)
    SoftField(l("6-digit code", "رمز من ٦ أرقام"), state.code, vm::onCode, icon = Icons.Outlined.Pin, keyboardType = KeyboardType.NumberPassword)
}

@Composable
private fun RecoveryStep(vm: SetupViewModel, state: SetupUiState) {
    val clipboard = LocalClipboardManager.current
    Text(l("Save your recovery codes", "احفظ رموز الاسترداد"), style = MaterialTheme.typography.headlineSmall, color = CarColors.Navy)
    Text(l("If you lose this phone, each code lets you sign in once. They are shown only now - write them down or keep them somewhere safe.",
        "إذا فقدت هذا الهاتف، كل رمز يتيح لك الدخول مرة واحدة. تظهر الآن فقط، اكتبها أو احفظها في مكان آمن."), color = CarColors.TextSecondary)
    GlassCard {
        state.recoveryCodes.chunked(2).forEach { pair ->
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                pair.forEach { Text(it, Modifier.weight(1f), fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, color = CarColors.Navy, textAlign = TextAlign.Center) }
            }
        }
        Spacer(Modifier.height(6.dp))
        GhostButton(l("Copy all", "نسخ الكل"), { clipboard.setText(AnnotatedString(state.recoveryCodes.joinToString("\n"))) }, Modifier.fillMaxWidth(), icon = Icons.Outlined.ContentCopy)
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(state.savedCodes, vm::onSavedCodes, colors = CheckboxDefaults.colors(checkedColor = CarColors.Teal))
        Text(l("I saved them somewhere safe", "حفظتها في مكان آمن"), color = CarColors.NavyInk)
    }
}
