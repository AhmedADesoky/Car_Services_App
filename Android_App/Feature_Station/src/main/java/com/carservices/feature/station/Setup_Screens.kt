package com.carservices.feature.station

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material.icons.outlined.Percent
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carservices.core.designsystem.CarButton
import com.carservices.core.designsystem.CarColors
import com.carservices.core.designsystem.CarDropdown
import com.carservices.core.designsystem.CarPage
import com.carservices.core.designsystem.CarRow
import com.carservices.core.designsystem.FloatingActionBar
import com.carservices.core.designsystem.GlassCard
import com.carservices.core.designsystem.GlassIconButton
import com.carservices.core.designsystem.KeyValue
import com.carservices.core.designsystem.PillTabs
import com.carservices.core.designsystem.SectionTitle
import com.carservices.core.designsystem.SoftField
import com.carservices.core.designsystem.StatusPill
import com.carservices.core.designsystem.Stepper
import com.carservices.core.designsystem.ToggleRow
import com.carservices.core.designsystem.l

/* =========================================================================== S3 setup wizard */

@Composable
fun SetupWizardScreen(nav: StationNav) {
    var step by remember { mutableIntStateOf(0) }
    var tax by remember { mutableStateOf<String?>("0%") }
    var receiptLang by remember { mutableStateOf<String?>("Arabic") }
    CarPage(title = Screen.S3.title(), subtitle = "${step + 1}/3", onBack = { if (step > 0) step-- else nav.back() },
        bottomBar = { FloatingActionBar { CarButton(if (step < 2) l("Next", "التالي") else l("Finish setup", "إنهاء الإعداد"), { if (step < 2) step++ else nav.replace(Screen.S4) }) } }) {
        item { Stepper(3, step) }
        item {
            AnimatedContent(step, label = "setup") { s ->
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    when (s) {
                        0 -> {
                            Text(l("Your station", "محطتك"), style = MaterialTheme.typography.headlineSmall, color = CarColors.Navy)
                            SoftField(l("Name (English)", "الاسم (إنجليزي)"), "Al Nour Auto Care", {}, icon = Icons.Outlined.Storefront)
                            SoftField(l("Name (Arabic)", "الاسم (عربي)"), "النور لخدمة السيارات", {})
                            SoftField(l("Tax registration no.", "رقم التسجيل الضريبي"), "", {}, placeholder = "123-456-789")
                        }
                        1 -> {
                            Text(l("Tax & receipts", "الضريبة والإيصالات"), style = MaterialTheme.typography.headlineSmall, color = CarColors.Navy)
                            CarDropdown(l("VAT rate", "نسبة الضريبة"), listOf("0%", "5%"), tax, { tax = it }, { it }, icon = Icons.Outlined.Percent, hint = { if (it == "0%") l("Kuwait: no VAT today", "الكويت: لا ضريبة قيمة مضافة حالياً") else l("Ready for GCC VAT", "جاهز لضريبة دول الخليج") })
                            CarDropdown(l("Receipt language", "لغة الإيصال"), listOf("Arabic", "English", "Both"), receiptLang, { receiptLang = it }, { it })
                            GlassCard(padding = 8.dp) { ToggleRow(l("Prices include VAT", "الأسعار شاملة الضريبة"), initial = false) }
                        }
                        else -> {
                            Text(l("First branch", "الفرع الأول"), style = MaterialTheme.typography.headlineSmall, color = CarColors.Navy)
                            SoftField(l("Branch name", "اسم الفرع"), "Shuwaikh", {}, icon = Icons.Outlined.Place)
                            SoftField(l("Address", "العنوان"), "Block 2, Street 28, Shuwaikh Industrial", {})
                            Text(l("Next you'll draw the check-in area on the map.", "بعد ذلك سترسم نطاق الحضور على الخريطة."), color = CarColors.TextSecondary)
                        }
                    }
                }
            }
        }
    }
}

/* ===================================================================== S4 branches + geofence */

@Composable
fun BranchesScreen(nav: StationNav) {
    var radius by remember { mutableFloatStateOf(100f) }
    var branch by remember { mutableIntStateOf(0) }
    CarPage(title = Screen.S4.title(), onBack = nav::back, actions = { GlassIconButton(Icons.Outlined.Add, l("Add branch", "إضافة فرع"), {}) },
        bottomBar = { FloatingActionBar { CarButton(l("Save geofence", "حفظ النطاق"), { nav.back() }, icon = Icons.Outlined.Check) } }) {
        item { PillTabs(listOf(l("Shuwaikh", "الشويخ"), l("Salmiya", "السالمية")), branch, { branch = it }) }
        item { GeofenceMap(radius) }
        item {
            GlassCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(l("Check-in radius", "نطاق الحضور"), color = CarColors.NavyInk, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Text("${radius.toInt()} m", color = CarColors.Teal, fontWeight = FontWeight.ExtraBold)
                }
                Slider(radius, { radius = it }, valueRange = 30f..1000f, colors = SliderDefaults.colors(thumbColor = CarColors.Teal, activeTrackColor = CarColors.Teal, inactiveTrackColor = CarColors.Divider))
                if (radius < 50) StatusPill(l("Under 50 m: GPS may refuse real workers", "أقل من ٥٠ م: قد يرفض GPS عمالاً حقيقيين"), CarColors.Orange)
            }
        }
        item { GlassCard(padding = 8.dp) { CarRow(l("Use my current location as centre", "استخدم موقعي الحالي كمركز"), l("Accuracy 6 m", "الدقة ٦ م"), icon = Icons.Outlined.MyLocation, onClick = {}) } }
    }
}

/** Stylised map (UI only; Google Maps Compose replaces it): street grid, branch pin, pulsing radius. */
@Composable
private fun GeofenceMap(radius: Float) {
    val t = rememberInfiniteTransition(label = "geo")
    val pulse by t.animateFloat(0.85f, 1.05f, infiniteRepeatable(tween(1400), RepeatMode.Reverse), label = "p")
    Box(Modifier.fillMaxWidth().height(280.dp).clip(RoundedCornerShape(26.dp)).background(Color(0xFFE8EEF4)), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val step = 46.dp.toPx()
            var x = 0f; while (x < size.width) { drawLine(Color.White, Offset(x, 0f), Offset(x + 40f, size.height), 6.dp.toPx()); x += step * 1.6f }
            var y = 0f; while (y < size.height) { drawLine(Color.White, Offset(0f, y), Offset(size.width, y - 30f), 4.dp.toPx()); y += step }
            drawLine(Color(0xFFFFE3A8), Offset(0f, size.height * 0.62f), Offset(size.width, size.height * 0.48f), 12.dp.toPx())
            val r = (radius / 1000f) * size.minDimension * 0.9f + 18.dp.toPx()
            val c = center
            drawCircle(CarColors.Teal.copy(alpha = 0.14f), r * pulse, c)
            drawCircle(CarColors.Teal, r, c, style = Stroke(2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(14f, 10f))))
        }
        Box(Modifier.size(38.dp).clip(CircleShape).background(CarColors.Navy), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Storefront, null, tint = CarColors.Amber, modifier = Modifier.size(20.dp)) }
    }
}

/* ================================================================ 19 worker account + location */

@Composable
fun WorkerAccountScreen(nav: StationNav) {
    val branches = remember { mutableStateListOf(true, false) }
    CarPage(title = Screen.Acc19.title(), subtitle = "Karim Adel", onBack = nav::back) {
        item {
            GlassCard {
                KeyValue(l("Username", "اسم المستخدم"), "karim.adel")
                KeyValue(l("Role", "الدور"), l("Worker", "عامل"))
                KeyValue(l("2-step verification", "التحقق بخطوتين"), l("Not required", "غير مطلوب"))
            }
        }
        item { SectionTitle(l("Where can they check in?", "أين يمكنه تسجيل الحضور؟")) }
        item {
            GlassCard(padding = 8.dp) {
                listOf(l("Shuwaikh", "الشويخ"), l("Salmiya", "السالمية")).forEachIndexed { i, b ->
                    CarRow(b, l("Geofence 100 m", "نطاق ١٠٠ م"), icon = Icons.Outlined.Place, onClick = { branches[i] = !branches[i] }) {
                        Box(Modifier.size(24.dp).clip(CircleShape).background(if (branches[i]) CarColors.Teal else CarColors.Divider), contentAlignment = Alignment.Center) { if (branches[i]) Icon(Icons.Outlined.Check, null, tint = Color.White, modifier = Modifier.size(16.dp)) }
                    }
                }
            }
        }
        item { GlassCard(padding = 8.dp) { ToggleRow(l("Location only during the shift", "الموقع أثناء الوردية فقط"), l("Required by privacy rules", "مطلوب بقواعد الخصوصية"), icon = Icons.Outlined.Lock) } }
    }
}

/* =========================================================================== 20 services */

@Composable
fun ServicesScreen(nav: StationNav) {
    var query by remember { mutableStateOf("") }
    CarPage(title = Screen.Services.title(), subtitle = l("${Mock.services.size} services", "${Mock.services.size} خدمات"), onBack = nav::back, actions = { GlassIconButton(Icons.Outlined.Add, l("Add service", "إضافة خدمة"), {}) }) {
        item { SoftField(l("Search", "بحث"), query, { query = it }, icon = Icons.Outlined.Search) }
        items(Mock.services.filter { query.isBlank() || it.name.contains(query, true) }) { s ->
            GlassCard(padding = 10.dp) {
                CarRow(l(s.name, s.nameAr), l("Since 1 Oct · was ${kwd(s.price - 500)}", "منذ ١ أكتوبر · كان ${kwd(s.price - 500, true)}"), icon = Icons.Outlined.History, onClick = {}) {
                    Text(money(s.price), fontWeight = FontWeight.Bold, color = CarColors.Navy)
                }
            }
        }
        item { Text(l("Price changes apply to new orders only; open orders keep their price.", "تغيير السعر يطبق على الطلبات الجديدة فقط."), color = CarColors.TextSecondary, fontSize = 13.sp) }
    }
}

/* ========================================================================= 21 tax & permissions */

@Composable
fun TaxPermissionsScreen(nav: StationNav) {
    val perms = listOf(l("Open orders", "فتح طلبات"), l("Take payments", "تحصيل"), l("Refunds", "مرتجعات"), l("See revenue", "رؤية الإيراد"), l("Manage workers", "إدارة العمال"))
    val roles = listOf(l("Worker", "عامل"), l("Cashier", "كاشير"), l("Manager", "مدير"))
    val grid = remember { mutableStateListOf(true, true, true, false, true, true, false, true, true, false, false, true, false, false, true) }
    CarPage(title = Screen.Tax.title(), onBack = nav::back) {
        item {
            GlassCard {
                KeyValue(l("VAT", "الضريبة"), "0%", strong = true)
                KeyValue(l("Status", "الحالة"), l("Not applied in Kuwait", "غير مطبقة في الكويت"))
                KeyValue(l("When VAT starts", "عند تطبيق الضريبة"), l("Set the rate here", "حدّد النسبة هنا"))
            }
        }
        item { SectionTitle(l("Permissions", "الصلاحيات")) }
        item {
            GlassCard {
                Row { Spacer(Modifier.weight(1.6f)); roles.forEach { Text(it, Modifier.weight(1f), style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary, textAlign = androidx.compose.ui.text.style.TextAlign.Center) } }
                perms.forEachIndexed { r, p ->
                    Row(Modifier.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(p, Modifier.weight(1.6f), color = CarColors.NavyInk, style = MaterialTheme.typography.bodyMedium)
                        roles.indices.forEach { c ->
                            val i = r * 3 + c
                            Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                                Box(Modifier.size(26.dp).clip(RoundedCornerShape(8.dp)).background(if (grid[i]) CarColors.Teal else CarColors.Navy.copy(alpha = 0.06f)).clickable { grid[i] = !grid[i] }, contentAlignment = Alignment.Center) {
                                    if (grid[i]) Icon(Icons.Outlined.Check, null, tint = Color.White, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/* ========================================================================== S12 custom roles */

@Composable
fun RolesScreen(nav: StationNav) {
    val roles = listOf(Triple(l("Senior mechanic", "ميكانيكي أول"), 3, 9), Triple(l("Night cashier", "كاشير ليلي"), 2, 5), Triple(l("Auditor", "مراجع"), 1, 4))
    CarPage(title = Screen.Roles.title(), onBack = nav::back, actions = { GlassIconButton(Icons.Outlined.Add, l("New role", "دور جديد"), {}) }) {
        item {
            GlassCard(padding = 14.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.WorkspacePremium, null, tint = CarColors.Amber)
                    Spacer(Modifier.width(10.dp))
                    Text(l("Custom roles are part of the Pro plan.", "الأدوار المخصصة ضمن باقة Pro."), color = CarColors.NavyInk, modifier = Modifier.weight(1f))
                }
            }
        }
        items(roles) { (name, people, perms) ->
            GlassCard(padding = 10.dp) { CarRow(name, l("$people people · $perms permissions", "$people أشخاص · $perms صلاحيات"), icon = Icons.Outlined.Lock, onClick = { nav.open(Screen.Tax) }) }
        }
        item {
            GlassCard(padding = 14.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.WarningAmber, null, tint = CarColors.Orange); Spacer(Modifier.width(10.dp))
                    Text(l("Changing a role signs its people out so new rights apply at once.", "تعديل الدور يسجّل خروج أصحابه لتطبيق الصلاحيات فوراً."), color = CarColors.TextSecondary, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}
