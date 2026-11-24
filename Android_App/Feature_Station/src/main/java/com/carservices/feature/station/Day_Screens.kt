package com.carservices.feature.station

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Face
import androidx.compose.material.icons.outlined.GpsFixed
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material.icons.outlined.WifiOff
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carservices.core.designsystem.Avatar
import com.carservices.core.designsystem.CheckStatus
import com.carservices.core.designsystem.CueDots
import com.carservices.core.designsystem.FaceCue
import com.carservices.core.designsystem.FaceCueLine
import com.carservices.core.designsystem.FaceScanState
import com.carservices.core.designsystem.FaceScanner
import com.carservices.core.designsystem.ScanChip
import com.carservices.core.designsystem.VerifyRow
import com.carservices.core.designsystem.BigNumber
import com.carservices.core.designsystem.CameraViewfinder
import com.carservices.core.designsystem.CarButton
import com.carservices.core.designsystem.CarColors
import com.carservices.core.designsystem.CarPage
import com.carservices.core.designsystem.CarRow
import com.carservices.core.designsystem.FloatingActionBar
import com.carservices.core.designsystem.GhostButton
import com.carservices.core.designsystem.GlassCard
import com.carservices.core.designsystem.Glyph
import com.carservices.core.designsystem.HairDivider
import com.carservices.core.designsystem.KeyValue
import com.carservices.core.designsystem.LiveDot
import com.carservices.core.designsystem.MeterBar
import com.carservices.core.designsystem.NavyCard
import com.carservices.core.designsystem.RingProgress
import com.carservices.core.designsystem.SectionTitle
import com.carservices.core.designsystem.SoftField
import com.carservices.core.designsystem.StatusPill
import com.carservices.core.designsystem.Stepper
import com.carservices.core.designsystem.ToggleRow
import com.carservices.core.designsystem.l
import kotlinx.coroutines.delay

/* ===================================================================== 03 check-in (face + GPS) */

@Composable
fun CheckInScreen(nav: StationNav) {
    // 0 ready · 1 look · 2 blink · 3 turn · 4 verifying · 5 done  (UI simulation; the face + liveness engines drive this later)
    var step by remember { mutableIntStateOf(0) }
    LaunchedEffect(step) { if (step in 1..4) { delay(if (step == 4) 1400 else 1500); step++ } }
    val state = when (step) { 0 -> FaceScanState.Idle; in 1..3 -> FaceScanState.Scanning; 4 -> FaceScanState.Verifying; else -> FaceScanState.Success }
    val cue = when (step) { 2 -> FaceCue.Blink; 3 -> FaceCue.TurnLeft; 4 -> FaceCue.Hold; else -> FaceCue.Look }
    val prompt = when (step) {
        0 -> l("Center your face in the circle", "ضع وجهك داخل الدائرة")
        1 -> l("Look straight at the camera", "انظر مباشرة إلى الكاميرا")
        2 -> l("Blink slowly", "ارمش ببطء")
        3 -> l("Turn your head left", "أدر رأسك لليسار")
        4 -> l("Hold still… verifying", "اثبت… جارٍ التحقق")
        else -> l("Identity confirmed", "تم تأكيد الهوية")
    }
    CarPage(
        title = l("Face check-in", "تسجيل الحضور بالوجه"), subtitle = l("Shuwaikh branch · Shift 08:00", "فرع الشويخ · وردية ٠٨:٠٠"), onBack = nav::back,
        bottomBar = {
            FloatingActionBar {
                when (step) {
                    0 -> CarButton(l("Start face check", "ابدأ التحقق بالوجه"), { step = 1 }, icon = Icons.Outlined.Face, )
                    5 -> CarButton(l("Continue", "متابعة"), { nav.replace(Screen.CheckInOk) }, icon = Icons.Outlined.CheckCircle, tone = CarColors.Teal)
                    else -> CarButton(l("Scanning…", "جارٍ المسح…"), {}, enabled = false, tone = CarColors.Teal)
                }
                GhostButton(l("Having trouble? Ask your manager", "مشكلة؟ اطلب من المدير"), { nav.replace(Screen.CheckInRefused) }, Modifier.fillMaxWidth())
            }
        },
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
                ScanChip("LIVE", CarColors.Orange, live = true, light = true)
                ScanChip(l("Liveness on", "التحقق الحي"), CarColors.Teal, light = true)
                ScanChip("GPS ±8 m", CarColors.Teal, light = true)
            }
        }
        item { FaceScanner(progress = (step / 4f).coerceAtMost(1f), state = state, modifier = Modifier.padding(horizontal = 20.dp), light = true) }
        item {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                FaceCueLine(cue, prompt, light = true)
                Spacer(Modifier.height(12.dp))
                CueDots(5, (step - 1).coerceIn(0, 4), light = true)
            }
        }
        item {
            GlassCard(padding = 14.dp) {
                Text(l("VERIFICATION", "التحقق"), style = MaterialTheme.typography.labelMedium.copy(letterSpacing = 1.4.sp), color = CarColors.TextSecondary)
                VerifyRow(l("Inside the branch", "داخل الفرع"), l("40 m from centre · real GPS", "٤٠ م من المركز · GPS حقيقي"), Icons.Outlined.GpsFixed, CheckStatus.Passed)
                VerifyRow(l("Live person", "شخص حي"), l("Blink + head turn", "رمشة + إدارة الرأس"), Icons.Outlined.Verified,
                    when { step >= 4 -> CheckStatus.Passed; step >= 1 -> CheckStatus.Working; else -> CheckStatus.Waiting })
                VerifyRow(l("Face match", "تطابق الوجه"), if (step >= 5) l("98.6% match · Karim Adel", "تطابق ٩٨٫٦٪ · كريم عادل") else l("Compared on this phone", "تتم المقارنة على هذا الهاتف"), Icons.Outlined.Face,
                    when { step >= 5 -> CheckStatus.Passed; step == 4 -> CheckStatus.Working; else -> CheckStatus.Waiting })
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Shield, null, tint = CarColors.Teal, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(6.dp))
                Text(l("Your photo never leaves the phone, only a secure template.", "صورتك لا تغادر الهاتف، فقط قالب آمن."), color = CarColors.TextSecondary, fontSize = 12.sp)
            }
        }
    }
}

/* ======================================================================= 04 confirmed / 05 refused */

@Composable
fun CheckInResultScreen(nav: StationNav, ok: Boolean) {
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val pop by animateFloatAsState(if (shown) 1f else 0.4f, spring(dampingRatio = 0.45f, stiffness = Spring.StiffnessLow), label = "pop")
    val accent = if (ok) CarColors.Teal else CarColors.Orange
    CarPage(title = if (ok) Screen.CheckInOk.title() else Screen.CheckInRefused.title(), onBack = nav::back,
        bottomBar = { FloatingActionBar { CarButton(if (ok) l("Go to my orders", "إلى طلباتي") else l("Try again", "حاول مرة أخرى"), { if (ok) nav.home() else nav.replace(Screen.CheckIn) }, tone = if (ok) CarColors.Navy else CarColors.Orange) } }) {
        item {
            Column(Modifier.fillMaxWidth().padding(top = 30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.scale(pop)) { Glyph(if (ok) Icons.Outlined.CheckCircle else Icons.Outlined.Block, size = 120.dp, active = true, tint = accent) }
                Spacer(Modifier.height(20.dp))
                Text(if (ok) l("You're checked in", "تم تسجيل حضورك") else l("We couldn't check you in", "تعذّر تسجيل حضورك"), style = MaterialTheme.typography.headlineMedium, color = CarColors.Navy, textAlign = TextAlign.Center)
                Text(if (ok) l("08:57 · 3 minutes early. Have a good shift!", "٠٨:٥٧ · قبل الموعد بـ٣ دقائق. وردية موفقة!") else l("Your location is outside the branch (310 m away).", "موقعك خارج الفرع (على بعد ٣١٠ م)."), style = MaterialTheme.typography.bodyLarge, color = CarColors.TextSecondary, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
            }
        }
        item {
            GlassCard {
                if (ok) {
                    KeyValue(l("Branch", "الفرع"), l("Shuwaikh", "الشويخ"))
                    KeyValue(l("Face match", "تطابق الوجه"), "98.6%", valueColor = CarColors.Teal)
                    KeyValue(l("Live check", "التحقق الحي"), l("Passed", "ناجح"), valueColor = CarColors.Teal)
                    KeyValue(l("Shift ends", "نهاية الوردية"), "17:00")
                } else {
                    CarRow(l("Move closer to the branch", "اقترب من الفرع"), l("Check-in works within 100 m", "التسجيل يعمل في نطاق ١٠٠ م"), icon = Icons.Outlined.GpsFixed)
                    CarRow(l("Use good light", "استخدم إضاءة جيدة"), l("Face the light, remove sunglasses", "واجه الضوء وانزع النظارة"), icon = Icons.Outlined.Face)
                    CarRow(l("Still stuck?", "ما زالت المشكلة؟"), l("Your manager can approve it manually", "يمكن للمدير الموافقة يدوياً"), icon = Icons.Outlined.Shield)
                }
            }
        }
    }
}

/* ============================================================================= 06 check-out */

@Composable
fun CheckOutScreen(nav: StationNav) {
    CarPage(title = Screen.CheckOut.title(), subtitle = l("Today", "اليوم"), onBack = nav::back,
        bottomBar = { FloatingActionBar { CarButton(l("Check out with my face", "سجّل الانصراف بوجهك"), { nav.home() }, icon = Icons.Outlined.Face) } }) {
        item {
            NavyCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RingProgress(0.94f, size = 104.dp, stroke = 9.dp, color = CarColors.Amber, track = Color.White.copy(alpha = 0.1f)) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) { BigNumber("7:32", Color.White, 24); Text(l("hours", "ساعة"), color = Color.White.copy(alpha = 0.6f), fontSize = 11.sp) }
                    }
                    Spacer(Modifier.width(18.dp))
                    Column {
                        Text(l("Great shift!", "وردية رائعة!"), color = Color.White, style = MaterialTheme.typography.titleMedium)
                        Text(l("08:57 → 16:29", "٠٨:٥٧ ← ١٦:٢٩"), color = CarColors.TealGlow, style = MaterialTheme.typography.bodyMedium)
                        Text(l("Break 45 min", "استراحة ٤٥ د"), color = Color.White.copy(alpha = 0.6f), style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
        item {
            GlassCard {
                SectionTitle(l("Work done", "العمل المنجز"))
                KeyValue(l("Jobs finished", "أعمال منجزة"), "9", strong = true)
                KeyValue(l("Cars served", "سيارات"), "6")
                KeyValue(l("Average job time", "متوسط وقت العمل"), l("31 min", "٣١ د"))
                KeyValue(l("Customer rating", "تقييم العملاء"), "4.8 ★", valueColor = CarColors.Amber)
            }
        }
    }
}

/* ========================================================================= S2 password + 2FA */

@Composable
fun PasswordScreen(nav: StationNav) {
    var step by remember { mutableIntStateOf(0) }
    var pass by remember { mutableStateOf("") }
    var saved by remember { mutableStateOf(false) }
    val rules = listOf(l("At least 10 characters", "١٠ أحرف على الأقل") to (pass.length >= 10), l("Letters and numbers", "حروف وأرقام") to (pass.any { it.isLetter() } && pass.any { it.isDigit() }), l("A symbol", "رمز") to pass.any { !it.isLetterOrDigit() })
    CarPage(title = Screen.S2.title(), subtitle = l("Step ${step + 1} of 3", "الخطوة ${step + 1} من ٣"), onBack = nav::back,
        bottomBar = { FloatingActionBar { CarButton(if (step < 2) l("Continue", "متابعة") else l("Finish", "إنهاء"), { if (step < 2) step++ else nav.back() }, enabled = step != 2 || saved) } }) {
        item { Stepper(3, step) }
        when (step) {
            0 -> {
                item { Text(l("Choose a new password", "اختر كلمة مرور جديدة"), style = MaterialTheme.typography.headlineSmall, color = CarColors.Navy) }
                item { SoftField(l("New password", "كلمة المرور الجديدة"), pass, { pass = it }, icon = Icons.Outlined.Lock) }
                item {
                    GlassCard(padding = 14.dp) {
                        rules.forEach { (text, met) ->
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                                Icon(Icons.Outlined.CheckCircle, null, tint = if (met) CarColors.Teal else CarColors.Divider, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(10.dp)); Text(text, color = if (met) CarColors.NavyInk else CarColors.TextSecondary, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                        Spacer(Modifier.height(8.dp)); MeterBar(rules.count { it.second } / 3f)
                    }
                }
            }
            1 -> {
                item { Text(l("Turn on 2-step verification", "فعّل التحقق بخطوتين"), style = MaterialTheme.typography.headlineSmall, color = CarColors.Navy) }
                item { Text(l("Scan this code with Google Authenticator or Microsoft Authenticator.", "امسح الرمز بتطبيق Google Authenticator أو Microsoft Authenticator."), color = CarColors.TextSecondary) }
                item {
                    GlassCard {
                        Box(Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) { QrMock() }
                        HairDivider()
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("JBSW Y3DP EHPK 3PXP", fontFamily = FontFamily.Monospace, color = CarColors.Navy, modifier = Modifier.weight(1f))
                            Icon(Icons.Outlined.ContentCopy, l("Copy", "نسخ"), tint = CarColors.Teal)
                        }
                    }
                }
                item { SoftField(l("6-digit code", "الرمز المكوّن من ٦ أرقام"), "", {}, icon = Icons.Outlined.Key, placeholder = "123 456") }
            }
            else -> {
                item { Text(l("Save your recovery codes", "احفظ رموز الاسترداد"), style = MaterialTheme.typography.headlineSmall, color = CarColors.Navy) }
                item { Text(l("Each code works once if you lose your phone. They are shown only now.", "كل رمز يعمل مرة واحدة إذا فقدت هاتفك. تظهر الآن فقط."), color = CarColors.TextSecondary) }
                item {
                    GlassCard {
                        listOf("7KQ2-9XM4", "P3LD-8WZT", "H6RN-2CVA", "Y9BE-5JKU", "M4TF-1QGS", "D8WP-6NHX").chunked(2).forEach { pair ->
                            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) { pair.forEach { Text(it, Modifier.weight(1f), fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, color = CarColors.Navy, textAlign = TextAlign.Center) } }
                        }
                    }
                }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(saved, { saved = it }, colors = CheckboxDefaults.colors(checkedColor = CarColors.Teal))
                        Text(l("I saved them somewhere safe", "حفظتها في مكان آمن"), color = CarColors.NavyInk)
                    }
                }
            }
        }
    }
}

@Composable
private fun QrMock() {
    val pattern = remember { List(21 * 21) { i -> ((i * 7919) xor (i / 21 * 104729)) % 3 == 0 } }
    Column(Modifier.size(168.dp).clip(RoundedCornerShape(16.dp)).background(Color.White).border(1.dp, CarColors.Divider, RoundedCornerShape(16.dp)).padding(10.dp)) {
        for (r in 0 until 21) Row(Modifier.weight(1f)) {
            for (c in 0 until 21) {
                val finder = (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7)
                val ring = finder && ((r % 14 == 0 || r % 14 == 6 || c % 14 == 0 || c % 14 == 6 || (r in 2..4 || r in 16..18) && (c in 2..4 || c in 16..18)))
                val on = if (finder) ring else pattern[r * 21 + c]
                Box(Modifier.weight(1f).fillMaxWidth().background(if (on) CarColors.Navy else Color.Transparent))
            }
        }
    }
}

/* ============================================================================= W7 my profile */

@Composable
fun MyProfileScreen(nav: StationNav, userName: String) {
    CarPage(title = Screen.W7.title(), onBack = nav::back) {
        item {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Avatar(userName.ifBlank { "Me" }, size = 92.dp)
                Spacer(Modifier.height(10.dp))
                Text(userName, style = MaterialTheme.typography.headlineSmall, color = CarColors.Navy)
                StatusPill(l("Owner · Shuwaikh", "مالك · الشويخ"), CarColors.Teal, Modifier.padding(top = 6.dp))
            }
        }
        item {
            GlassCard(padding = 8.dp) {
                CarRow(l("Phone", "الهاتف"), "+965 9000 0000", icon = Icons.Outlined.Phone, onClick = {})
                CarRow(l("Email", "البريد"), "owner@station.example", icon = Icons.Outlined.Email, onClick = {})
                CarRow(l("Language", "اللغة"), l("English", "العربية"), icon = Icons.Outlined.Language, onClick = {})
                CarRow(l("Password & 2-step", "كلمة المرور والتحقق"), l("Changed 12 days ago", "تم التغيير منذ ١٢ يوماً"), icon = Icons.Outlined.Lock, onClick = { nav.open(Screen.S2) })
            }
        }
        item { SectionTitle(l("This month", "هذا الشهر")) }
        item {
            GlassCard {
                KeyValue(l("Days worked", "أيام العمل"), "18 / 22")
                KeyValue(l("On time", "في الموعد"), "94%", valueColor = CarColors.Teal)
                KeyValue(l("Jobs finished", "أعمال منجزة"), "143")
            }
        }
        item { GlassCard(padding = 8.dp) { ToggleRow(l("Quick unlock with fingerprint", "فتح سريع بالبصمة"), icon = Icons.Outlined.Shield) } }
    }
}

