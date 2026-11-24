package com.carservices.feature.station

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Face
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material.icons.outlined.Work
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.carservices.core.designsystem.Avatar
import com.carservices.core.designsystem.CheckStatus
import com.carservices.core.designsystem.FaceCue
import com.carservices.core.designsystem.FaceCueLine
import com.carservices.core.designsystem.FaceScanState
import com.carservices.core.designsystem.FaceScanner
import com.carservices.core.designsystem.ScanChip
import com.carservices.core.designsystem.VerifyRow
import com.carservices.core.designsystem.CameraViewfinder
import com.carservices.core.designsystem.CarButton
import com.carservices.core.designsystem.CarColors
import com.carservices.core.designsystem.CarDropdown
import com.carservices.core.designsystem.CarPage
import com.carservices.core.designsystem.CarRow
import com.carservices.core.designsystem.FloatingActionBar
import com.carservices.core.designsystem.GhostButton
import com.carservices.core.designsystem.GlassCard
import com.carservices.core.designsystem.GlassIconButton
import com.carservices.core.designsystem.KeyValue
import com.carservices.core.designsystem.MeterBar
import com.carservices.core.designsystem.PillTabs
import com.carservices.core.designsystem.SectionTitle
import com.carservices.core.designsystem.SoftField
import com.carservices.core.designsystem.StatusPill
import com.carservices.core.designsystem.Stepper
import com.carservices.core.designsystem.ToggleRow
import com.carservices.core.designsystem.l
import kotlinx.coroutines.delay

/* =============================================================================== W1 workers */

@Composable
fun WorkersScreen(nav: StationNav) {
    var filter by remember { mutableIntStateOf(0) }
    var query by remember { mutableStateOf("") }
    CarPage(title = Screen.W1.title(), subtitle = l("8 / 10 seats used", "٨ / ١٠ مقاعد مستخدمة"), onBack = nav::back,
        actions = { GlassIconButton(Icons.Outlined.PersonAdd, Screen.W2.title(), { nav.open(Screen.W2) }) }) {
        item { MeterBar(0.8f) }
        item { SoftField(l("Search", "بحث"), query, { query = it }, icon = Icons.Outlined.Search, placeholder = l("Name, username or phone", "الاسم أو اسم المستخدم أو الهاتف")) }
        item { PillTabs(listOf(l("All", "الكل"), l("On site", "في المحطة"), l("Late", "متأخر"), l("Off", "إجازة"), l("Suspended", "موقوف")), filter, { filter = it }) }
        items(Mock.workers.filter { (filter == 0 || it.status.ordinal == filter - 1) && (query.isBlank() || it.name.contains(query, true)) }) { w ->
            GlassCard(padding = 10.dp) {
                CarRow(w.name, "${l(w.role, w.roleAr)} · ${w.branch}", avatar = w.name, onClick = { nav.open(Screen.W3) }) { StatusPill(l(w.status.en, w.status.ar), w.status.color) }
            }
        }
    }
}

/* ===================================================================== W2 add / edit wizard */

@Composable
fun AddWorkerScreen(nav: StationNav) {
    var step by remember { mutableIntStateOf(0) }
    val titles = listOf(l("Personal", "بيانات شخصية"), l("Job & branch", "الوظيفة والفرع"), l("Account & role", "الحساب والدور"), l("Schedule", "المواعيد"), l("Review", "مراجعة"))
    var name by remember { mutableStateOf("") }
    var branch by remember { mutableStateOf<String?>("Nasr City") }
    var role by remember { mutableStateOf<String?>("Mechanic") }
    var accessRole by remember { mutableStateOf<String?>("Worker") }
    CarPage(title = Screen.W2.title(), subtitle = "${step + 1}/5 · ${titles[step]}", onBack = { if (step > 0) step-- else nav.back() },
        bottomBar = { FloatingActionBar { CarButton(if (step < 4) l("Next", "التالي") else l("Send invite", "إرسال الدعوة"), { if (step < 4) step++ else nav.back() }, icon = if (step == 4) Icons.Outlined.PersonAdd else null) } }) {
        item { Stepper(5, step) }
        item {
            AnimatedContent(step, transitionSpec = { (slideInHorizontally(tween(260)) { it / 4 } + fadeIn()) togetherWith fadeOut(tween(120)) }, label = "wizard") { s ->
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    when (s) {
                        0 -> {
                            SoftField(l("Full name", "الاسم بالكامل"), name, { name = it }, icon = Icons.Outlined.Person)
                            SoftField(l("Mobile", "الموبايل"), "", {}, icon = Icons.Outlined.Phone, placeholder = "+20 1xx xxx xxxx")
                            SoftField(l("National ID (owner only)", "الرقم القومي (للمالك فقط)"), "", {}, icon = Icons.Outlined.Badge, placeholder = "•••• •••• •••• ••")
                        }
                        1 -> {
                            CarDropdown(l("Job", "الوظيفة"), listOf("Mechanic", "Electrician", "Washer", "Tyres", "Cashier", "Branch manager"), role, { role = it }, { it }, icon = Icons.Outlined.Work)
                            CarDropdown(l("Branch", "الفرع"), listOf("Nasr City", "Heliopolis"), branch, { branch = it }, { it }, icon = Icons.Outlined.Storefront, hint = { l("Geofence 100 m", "نطاق ١٠٠ م") })
                            SoftField(l("Start date", "تاريخ البدء"), "1 Dec 2026", {}, icon = Icons.Outlined.CalendarMonth)
                        }
                        2 -> {
                            SoftField(l("Username", "اسم المستخدم"), name.lowercase().replace(' ', '.').ifBlank { "karim.adel" }, {}, icon = Icons.Outlined.Key)
                            CarDropdown(l("Access role", "دور الصلاحيات"), listOf("Worker", "Cashier", "Branch manager", "Accountant"), accessRole, { accessRole = it }, { it }, hint = { r -> when (r) { "Worker" -> l("Own orders only", "طلباته فقط"); "Cashier" -> l("Checkout and payments", "الدفع والتحصيل"); "Branch manager" -> l("Whole branch", "الفرع بالكامل"); else -> l("Money, read-only orders", "المال، الطلبات للقراءة") } })
                        }
                        3 -> GlassCard(padding = 8.dp) {
                            listOf(l("Sat – Thu", "السبت – الخميس") to "09:00 – 17:00", l("Friday", "الجمعة") to l("Off", "إجازة")).forEach { (d, t) -> CarRow(d, t, icon = Icons.Outlined.CalendarMonth, onClick = {}) }
                            ToggleRow(l("Allow overtime", "السماح بالعمل الإضافي"), initial = false)
                        }
                        else -> GlassCard {
                            KeyValue(l("Name", "الاسم"), name.ifBlank { "Karim Adel" })
                            KeyValue(l("Job", "الوظيفة"), role ?: "—")
                            KeyValue(l("Branch", "الفرع"), branch ?: "—")
                            KeyValue(l("Access", "الصلاحية"), accessRole ?: "—")
                            Text(l("They get an SMS invite. Face enrollment happens at the branch.", "سيصله رسالة دعوة. تسجيل الوجه يتم في الفرع."), color = CarColors.TextSecondary, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
                        }
                    }
                }
            }
        }
    }
}

/* ============================================================================== W3 profile */

@Composable
fun WorkerProfileScreen(nav: StationNav) {
    val w = Mock.workers[0]
    var tab by remember { mutableIntStateOf(0) }
    CarPage(title = w.name, subtitle = "${l(w.role, w.roleAr)} · ${w.branch}", onBack = nav::back, actions = { GlassIconButton(Icons.Outlined.Phone, l("Call", "اتصال"), {}) }) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(w.name, size = 72.dp)
                Spacer(Modifier.width(16.dp))
                Column { StatusPill(l(w.status.en, w.status.ar), w.status.color); Spacer(Modifier.height(6.dp)); Text("@karim.adel · ${l("since", "منذ")} ${w.since}", color = CarColors.TextSecondary) }
            }
        }
        item { PillTabs(listOf(l("Overview", "نظرة عامة"), l("Attendance", "الحضور"), l("Work", "العمل"), l("Documents", "المستندات"), l("Security", "الأمان")), tab, { if (it == 4) nav.open(Screen.W5) else tab = it }) }
        item {
            AnimatedContent(tab, label = "tab") { t ->
                GlassCard {
                    when (t) {
                        0 -> { KeyValue(l("Rating", "التقييم"), "${w.rating} ★", valueColor = CarColors.Amber); KeyValue(l("Jobs this month", "أعمال هذا الشهر"), "143"); KeyValue(l("On time", "في الموعد"), "96%", valueColor = CarColors.Teal); KeyValue(l("Face enrolled", "الوجه مسجل"), l("Yes · 3 Mar", "نعم · ٣ مارس")) }
                        1 -> listOf("08:52 → 17:04", "08:58 → 17:10", "09:07 → 17:01").forEachIndexed { i, x -> KeyValue(l("Day ${i + 1}", "يوم ${i + 1}"), x, valueColor = if (i == 2) CarColors.Amber else CarColors.NavyInk) }
                        2 -> Mock.orders.take(3).forEach { KeyValue(it.services, money(it.total)) }
                        else -> listOf(l("National ID", "البطاقة"), l("Contract", "العقد"), l("Driving licence", "رخصة القيادة")).forEach { CarRow(it, "PDF", icon = Icons.Outlined.Description, onClick = {}) }
                    }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GhostButton(l("Re-enroll face", "إعادة تسجيل الوجه"), { nav.open(Screen.W4) }, Modifier.weight(1f), icon = Icons.Outlined.Face)
                GhostButton(l("Deactivate", "إيقاف"), { nav.open(Screen.W6) }, Modifier.weight(1f), icon = Icons.Outlined.Block, color = CarColors.Orange)
            }
        }
    }
}

/* ======================================================================= W4 face enrollment */

@Composable
fun FaceEnrollScreen(nav: StationNav) {
    var captured by remember { mutableIntStateOf(0) }   // 1..5 capturing frames, 6 = template ready
    LaunchedEffect(captured) { if (captured in 1..5) { delay(if (captured == 5) 1200 else 900); captured++ } }
    val state = when (captured) { 0 -> FaceScanState.Idle; in 1..4 -> FaceScanState.Scanning; 5 -> FaceScanState.Verifying; else -> FaceScanState.Success }
    val checks = listOf(l("One face only", "وجه واحد فقط"), l("Sharp & well lit", "واضح ومضاء"), l("Looking straight", "ينظر للأمام"), l("Live person", "شخص حي"))
    val prompt = when (captured) {
        0 -> l("Ask the worker to face the camera", "اطلب من العامل مواجهة الكاميرا")
        5 -> l("Building template…", "جارٍ بناء القالب…")
        6 -> l("5 good frames captured", "تم التقاط ٥ لقطات جيدة")
        else -> l("Slowly move your head", "حرّك رأسك ببطء")
    }
    CarPage(title = Screen.W4.title(), subtitle = "Karim Adel · ${l("Mechanic", "ميكانيكي")}", onBack = nav::back,
        bottomBar = {
            FloatingActionBar {
                when (captured) {
                    0 -> CarButton(l("Start enrollment", "ابدأ التسجيل"), { captured = 1 }, icon = Icons.Outlined.Face, )
                    6 -> CarButton(l("Save face template", "حفظ قالب الوجه"), { nav.back() }, icon = Icons.Outlined.CheckCircle, tone = CarColors.Teal)
                    else -> CarButton(l("Capturing ${captured.coerceAtMost(5)} of 5…", "التقاط ${captured.coerceAtMost(5)} من ٥…"), {}, enabled = false, tone = CarColors.Teal)
                }
            }
        }) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
                ScanChip("LIVE", CarColors.Orange, live = true, light = true)
                ScanChip(l("Consent signed", "تمت الموافقة"), CarColors.Teal, light = true)
            }
        }
        item { FaceScanner(progress = captured / 6f, state = state, modifier = Modifier.padding(horizontal = 20.dp), light = true) }
        item { FaceCueLine(if (captured in 2..3) FaceCue.TurnRight else FaceCue.Look, prompt, light = true) }
        item {
            GlassCard(padding = 14.dp) {
                checks.forEachIndexed { i, c ->
                    VerifyRow(c, l("Quality gate ${i + 1}", "بوابة جودة ${i + 1}"), Icons.Outlined.CheckCircle,
                        when { captured > i + 1 -> CheckStatus.Passed; captured == i + 1 -> CheckStatus.Working; else -> CheckStatus.Waiting })
                }
                Text(l("Only a face template is stored, never the photo.", "يُحفظ قالب الوجه فقط، وليس الصورة."), style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary, modifier = Modifier.padding(top = 6.dp))
            }
        }
    }
}

/* ===================================================================== W5 account & security */

@Composable
fun AccountSecurityScreen(nav: StationNav) {
    CarPage(title = Screen.W5.title(), subtitle = "Karim Adel", onBack = nav::back) {
        item {
            GlassCard(padding = 8.dp) {
                CarRow(l("Reset password", "إعادة تعيين كلمة المرور"), l("A temporary password is shown once", "تظهر كلمة مؤقتة مرة واحدة"), icon = Icons.Outlined.Key, onClick = {})
                CarRow(l("Reset face", "إعادة تعيين الوجه"), l("Requires re-enrollment at the branch", "يتطلب التسجيل في الفرع"), icon = Icons.Outlined.Face, onClick = { nav.open(Screen.W4) })
            }
        }
        item { SectionTitle(l("Signed-in devices", "الأجهزة المسجلة")) }
        item {
            GlassCard(padding = 8.dp) {
                CarRow("Samsung Galaxy A54", l("Active now · Nasr City", "نشط الآن · مدينة نصر"), icon = Icons.Outlined.PhoneAndroid) { StatusPill(l("This branch", "هذا الفرع"), CarColors.Teal) }
                CarRow("Xiaomi Redmi 12", l("3 days ago", "منذ ٣ أيام"), icon = Icons.Outlined.PhoneAndroid) { Icon(Icons.AutoMirrored.Outlined.Logout, l("Sign out", "خروج"), tint = CarColors.Orange) }
            }
        }
        item { SectionTitle(l("Danger zone", "منطقة الخطر")) }
        item {
            GlassCard(padding = 8.dp) {
                CarRow(l("Suspend", "إيقاف مؤقت"), l("Signs out everywhere immediately", "يسجل الخروج من كل الأجهزة فوراً"), icon = Icons.Outlined.WarningAmber, onClick = {})
                CarRow(l("Deactivate", "إلغاء التفعيل"), l("Reassign open work first", "أعد إسناد الأعمال المفتوحة أولاً"), icon = Icons.Outlined.Block, onClick = { nav.open(Screen.W6) })
            }
        }
    }
}

/* ========================================================================== W6 deactivate */

@Composable
fun DeactivateScreen(nav: StationNav) {
    var reason by remember { mutableStateOf<String?>(null) }
    var to by remember { mutableStateOf<MockWorker?>(null) }
    CarPage(title = Screen.W6.title(), subtitle = "Karim Adel", onBack = nav::back,
        bottomBar = { FloatingActionBar { CarButton(l("Deactivate account", "إلغاء تفعيل الحساب"), { nav.home() }, tone = CarColors.Orange, enabled = reason != null && to != null) } }) {
        item { CarDropdown(l("Reason", "السبب"), listOf("Resigned", "Contract ended", "Dismissed", "Other"), reason, { reason = it }, { it }) }
        item { SoftField(l("Last working day", "آخر يوم عمل"), "30 Nov 2026", {}, icon = Icons.Outlined.CalendarMonth) }
        item { SectionTitle(l("Open work to reassign", "أعمال مفتوحة لإعادة الإسناد")) }
        item {
            GlassCard {
                KeyValue(l("Open orders", "طلبات مفتوحة"), "2", valueColor = CarColors.Orange)
                KeyValue(l("Scheduled shifts", "ورديات مجدولة"), "4")
                Spacer(Modifier.height(8.dp))
                CarDropdown(l("Reassign to", "إعادة الإسناد إلى"), Mock.workers.drop(1).filter { it.status == WorkerStatus.OnSite }, to, { to = it }, { it.name }, hint = { l(it.role, it.roleAr) })
            }
        }
        item { Text(l("Their history stays for reports. They can't sign in any more.", "يبقى سجلهم في التقارير. لن يتمكنوا من الدخول."), color = CarColors.TextSecondary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
    }
}

