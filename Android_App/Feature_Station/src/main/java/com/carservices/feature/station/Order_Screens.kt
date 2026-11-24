package com.carservices.feature.station

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.FlashOn
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Money
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.carservices.core.designsystem.Avatar
import com.carservices.core.designsystem.BigNumber
import com.carservices.core.designsystem.CameraViewfinder
import com.carservices.core.designsystem.CarButton
import com.carservices.core.designsystem.CarColors
import com.carservices.core.designsystem.CarDropdown
import com.carservices.core.designsystem.CarPage
import com.carservices.core.designsystem.CarRow
import com.carservices.core.designsystem.EgyptPlate
import com.carservices.core.designsystem.FloatingActionBar
import com.carservices.core.designsystem.GhostButton
import com.carservices.core.designsystem.GlassCard
import com.carservices.core.designsystem.GlassIconButton
import com.carservices.core.designsystem.Glyph
import com.carservices.core.designsystem.HairDivider
import com.carservices.core.designsystem.KeyValue
import com.carservices.core.designsystem.LiveDot
import com.carservices.core.designsystem.NavyCard
import com.carservices.core.designsystem.SectionTitle
import com.carservices.core.designsystem.SegmentedTabs
import com.carservices.core.designsystem.SoftField
import com.carservices.core.designsystem.StatusPill
import com.carservices.core.designsystem.ToggleRow
import com.carservices.core.designsystem.l
import kotlinx.coroutines.delay

/* ============================================================================== 07 scan plate */

@Composable
fun ScanPlateScreen(nav: StationNav) {
    var found by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { delay(1800); found = true }
    CarPage(title = Screen.Scan.title(), subtitle = l("Point at the plate", "وجّه الكاميرا للّوحة"), onBack = nav::back, dark = true,
        actions = { GlassIconButton(Icons.Outlined.FlashOn, l("Torch", "الإضاءة"), {}, dark = true) },
        bottomBar = {
            FloatingActionBar(dark = true) {
                AnimatedVisibility(found, enter = slideInVertically { it } + fadeIn()) {
                    GlassCard(padding = 16.dp) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(l("Returning car", "سيارة عائدة"), color = CarColors.Teal, style = MaterialTheme.typography.labelMedium)
                                Text("Hyundai Elantra 2021", style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk)
                                Text(l("Mostafa Hamdy · 14 visits", "مصطفى حمدي · ١٤ زيارة"), style = MaterialTheme.typography.bodyMedium, color = CarColors.TextSecondary)
                            }
                            StatusPill("97%", CarColors.Teal)
                        }
                        Spacer(Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            GhostButton(l("Edit", "تعديل"), { nav.replace(Screen.NewCar) }, icon = Icons.Outlined.Edit)
                            CarButton(l("Open order", "فتح طلب"), { nav.replace(Screen.Returning) }, Modifier.weight(1f))
                        }
                    }
                }
                GhostButton(l("Type the plate instead", "اكتب اللوحة يدوياً"), { nav.replace(Screen.NewCar) }, Modifier.fillMaxWidth(), color = Color.White)
            }
        },
    ) {
        item {
            CameraViewfinder(Modifier.aspectRatio(0.78f)) {
                val pop by animateFloatAsState(if (found) 1f else 0f, spring(dampingRatio = 0.5f, stiffness = Spring.StiffnessLow), label = "plate")
                Box(Modifier.scale(0.6f + 0.4f * pop)) { if (found) EgyptPlate("ق ر ب", "٤٥٦٧", scale = 1.15f) }
                Text(if (found) l("Plate recognised", "تم التعرف على اللوحة") else l("Hold steady…", "ثبّت الهاتف…"), color = Color.White, style = MaterialTheme.typography.titleMedium, modifier = Modifier.align(Alignment.BottomCenter).padding(20.dp))
            }
        }
    }
}

/* ================================================================================ 08 new car */

@Composable
fun NewCarScreen(nav: StationNav) {
    var letters by remember { mutableStateOf("ق ر ب") }
    var digits by remember { mutableStateOf("٤٥٦٧") }
    var make by remember { mutableStateOf<String?>("Hyundai") }
    var model by remember { mutableStateOf<String?>("Elantra") }
    var body by remember { mutableIntStateOf(0) }
    CarPage(title = Screen.NewCar.title(), onBack = nav::back, bottomBar = { FloatingActionBar { CarButton(l("Save & open order", "حفظ وفتح طلب"), { nav.replace(Screen.Repairs) }) } }) {
        item { Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { EgyptPlate(letters, digits, scale = 1.2f) } }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SoftField(l("Letters", "الحروف"), letters, { letters = it }, Modifier.weight(1f))
                SoftField(l("Numbers", "الأرقام"), digits, { digits = it }, Modifier.weight(1f))
            }
        }
        item { CarDropdown(l("Make", "الماركة"), listOf("Hyundai", "Kia", "Toyota", "Nissan", "Chevrolet", "Mitsubishi", "Renault", "Peugeot"), make, { make = it }, { it }, icon = Icons.Outlined.DirectionsCar) }
        item { CarDropdown(l("Model", "الموديل"), listOf("Elantra", "Accent", "Tucson", "Verna"), model, { model = it }, { it }, hint = { l("Sedan · 2015–2025", "سيدان · ٢٠١٥–٢٠٢٥") }) }
        item { SegmentedTabs(listOf(l("Sedan", "سيدان"), "SUV", l("Hatch", "هاتشباك"), l("Pickup", "بيك أب")), body, { body = it }) }
        item { SectionTitle(l("Customer", "العميل")) }
        item { SoftField(l("Name", "الاسم"), "", {}, icon = Icons.Outlined.Person) }
        item { SoftField(l("Mobile", "الموبايل"), "", {}, icon = Icons.Outlined.Phone, placeholder = "+20 1xx xxx xxxx") }
        item { GlassCard(padding = 8.dp) { ToggleRow(l("Send receipts on WhatsApp", "إرسال الإيصالات على واتساب"), l("Customer agreed", "وافق العميل"), icon = Icons.AutoMirrored.Outlined.Chat) } }
    }
}

/* ========================================================================== 09 returning car */

@Composable
fun ReturningCarScreen(nav: StationNav) {
    val visits = visits()
    CarPage(title = Screen.Returning.title(), onBack = nav::back, bottomBar = { FloatingActionBar { CarButton(l("Start new order", "بدء طلب جديد"), { nav.replace(Screen.Repairs) }, icon = Icons.Outlined.Add) } }) {
        item {
            NavyCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    EgyptPlate("ق ر ب", "٤٥٦٧", scale = 0.62f)
                    Spacer(Modifier.width(14.dp))
                    Column { Text("Hyundai Elantra 2021", color = Color.White, style = MaterialTheme.typography.titleMedium); Text(l("Silver · 84,200 km", "فضي · ٨٤٬٢٠٠ كم"), color = Color.White.copy(alpha = 0.6f)) }
                }
                Spacer(Modifier.height(16.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Avatar("Mostafa Hamdy", tone = CarColors.TealGlow)
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) { Text("Mostafa Hamdy", color = Color.White, fontWeight = FontWeight.SemiBold); Text(l("14 visits · since 2023", "١٤ زيارة · منذ ٢٠٢٣"), color = CarColors.TealGlow, style = MaterialTheme.typography.labelMedium) }
                    GlassIconButton(Icons.Outlined.Phone, l("Call", "اتصال"), {}, dark = true)
                }
            }
        }
        item {
            GlassCard(padding = 14.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Glyph(Icons.Outlined.WarningAmber, tint = CarColors.Orange, active = true)
                    Spacer(Modifier.width(12.dp))
                    Column { Text(l("Follow-up due", "متابعة مستحقة"), fontWeight = FontWeight.Bold, color = CarColors.NavyInk); Text(l("Rear brake pads were at 30% on 12 Oct", "تيل الفرامل الخلفي كان ٣٠٪ في ١٢ أكتوبر"), color = CarColors.TextSecondary, style = MaterialTheme.typography.bodyMedium) }
                }
            }
        }
        item { SectionTitle(l("Last visits", "آخر الزيارات"), action = l("Full history", "السجل الكامل")) { nav.open(Screen.History) } }
        items(visits) { (date, what, total) -> GlassCard(padding = 8.dp) { CarRow(what, date, icon = Icons.Outlined.History, onClick = { nav.open(Screen.History) }) { Text(money(total), fontWeight = FontWeight.Bold, color = CarColors.Navy) } } }
    }
}

@Composable
private fun visits() = listOf(
    Triple(l("12 Oct", "١٢ أكتوبر"), l("Oil change · Filter", "تغيير زيت · فلتر"), 1100),
    Triple(l("3 Aug", "٣ أغسطس"), l("Front brake pads", "تيل فرامل أمامي"), 1600),
    Triple(l("19 Jun", "١٩ يونيو"), l("Full wash · Polish", "غسيل كامل · تلميع"), 650),
)

/* =================================================================================== 10 history */

@Composable
fun HistoryScreen(nav: StationNav) {
    val visits = visits()
    CarPage(title = Screen.History.title(), subtitle = "Hyundai Elantra · ق ر ب ٤٥٦٧", onBack = nav::back) {
        item { GlassCard(padding = 14.dp) { Row { KeyStat("14", l("Visits", "زيارات")); KeyStat(money(18_450), l("Spent", "إنفاق")); KeyStat("4.9★", l("Rating", "تقييم")) } } }
        items(visits + visits) { (date, what, total) ->
            Row {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(22.dp).padding(top = 22.dp)) { Dot(CarColors.Teal); Box(Modifier.width(1.dp).height(70.dp).background(CarColors.Divider)) }
                Spacer(Modifier.width(8.dp))
                GlassCard(Modifier.weight(1f), padding = 14.dp) {
                    Text(date, style = MaterialTheme.typography.labelMedium, color = CarColors.Teal)
                    Text(what, style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk)
                    Row { Text(l("Karim Adel", "كريم عادل"), color = CarColors.TextSecondary, modifier = Modifier.weight(1f)); Text(money(total), fontWeight = FontWeight.Bold, color = CarColors.Navy) }
                }
            }
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.KeyStat(value: String, label: String) {
    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleMedium, color = CarColors.Navy, fontWeight = FontWeight.ExtraBold)
        Text(label, style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary)
    }
}

/* ========================================================================= 11 problem + repairs */

@Composable
fun RepairsScreen(nav: StationNav) {
    val picked = remember { mutableStateListOf(0, 1) }
    var problem by remember { mutableStateOf("") }
    var worker by remember { mutableStateOf<MockWorker?>(Mock.workers[0]) }
    val total = picked.sumOf { Mock.services[it].price }
    CarPage(title = Screen.Repairs.title(), subtitle = "ق ر ب ٤٥٦٧", onBack = nav::back,
        bottomBar = {
            FloatingActionBar {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${picked.size} ${l("services", "خدمات")}", color = CarColors.TextSecondary, modifier = Modifier.weight(1f))
                    Text(money(total), style = MaterialTheme.typography.headlineSmall, color = CarColors.Navy)
                }
                CarButton(l("Start the order", "ابدأ الطلب"), { nav.replace(Screen.InProgress) }, icon = Icons.Outlined.Timer, enabled = picked.isNotEmpty())
            }
        }) {
        item { SoftField(l("What's the problem?", "ما المشكلة؟"), problem, { problem = it }, placeholder = l("Noise when braking…", "صوت عند الفرملة…"), singleLine = false) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GhostButton(l("Voice note", "ملاحظة صوتية"), {}, Modifier.weight(1f), icon = Icons.Outlined.Mic)
                GhostButton(l("Photos", "صور"), {}, Modifier.weight(1f), icon = Icons.Outlined.CameraAlt)
            }
        }
        item { CarDropdown(l("Assign to", "إسناد إلى"), Mock.workers.filter { it.status == WorkerStatus.OnSite }, worker, { worker = it }, { it.name }, icon = Icons.Outlined.Person, hint = { l(it.role, it.roleAr) + " · ${it.jobs} " + l("jobs today", "أعمال اليوم") }) }
        item { SectionTitle(l("Services", "الخدمات")) }
        item { SoftField(l("Search services", "ابحث في الخدمات"), "", {}, icon = Icons.Outlined.Search) }
        items(Mock.services.indices.toList()) { i -> ServicePick(Mock.services[i], i in picked) { if (i in picked) picked.remove(i) else picked.add(i) } }
    }
}

@Composable
private fun ServicePick(s: MockService, on: Boolean, toggle: () -> Unit) {
    val ring by animateColorAsState(if (on) CarColors.Teal.copy(alpha = 0.6f) else CarColors.Navy.copy(alpha = 0.07f), label = "ring")
    val fill by animateColorAsState(if (on) CarColors.Teal else Color.Transparent, label = "fill")
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color.White.copy(alpha = 0.92f)).border(1.dp, ring, RoundedCornerShape(20.dp)).clickable(onClick = toggle).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(24.dp).clip(CircleShape).border(1.5.dp, if (on) CarColors.Teal else CarColors.Outline, CircleShape).background(fill), contentAlignment = Alignment.Center) {
            if (on) Icon(Icons.Outlined.Check, null, tint = Color.White, modifier = Modifier.size(16.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(l(s.name, s.nameAr), style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk)
            Text("~${s.minutes} ${l("min", "د")}", style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary)
        }
        Text(money(s.price), fontWeight = FontWeight.Bold, color = CarColors.Navy)
    }
}

/* ======================================================================= 12 order in progress */

@Composable
fun InProgressScreen(nav: StationNav) {
    var seconds by remember { mutableIntStateOf(24 * 60 + 13) }
    LaunchedEffect(Unit) { while (true) { delay(1000); seconds++ } }
    val done = remember { mutableStateListOf(false, false) }
    CarPage(title = "${l("Order", "طلب")} A-1042", subtitle = Screen.InProgress.title(), onBack = nav::back,
        bottomBar = { FloatingActionBar { CarButton(l("Ready for checkout", "جاهز للدفع"), { nav.replace(Screen.Checkout) }, icon = Icons.AutoMirrored.Outlined.ReceiptLong, enabled = done.all { it }) } }) {
        item {
            NavyCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) { LiveDot(CarColors.TealGlow); Spacer(Modifier.width(8.dp)); Text(l("Timer running", "المؤقت يعمل"), color = CarColors.TealGlow, style = MaterialTheme.typography.labelMedium) }
                        BigNumber("%02d:%02d".format(seconds / 60, seconds % 60), Color.White, 44)
                        Text("Hyundai Elantra · Mostafa Hamdy", color = Color.White.copy(alpha = 0.6f), style = MaterialTheme.typography.bodyMedium)
                    }
                    EgyptPlate("ق ر ب", "٤٥٦٧", scale = 0.5f)
                }
            }
        }
        item { SectionTitle(l("Jobs", "الأعمال"), action = l("+ Add", "+ إضافة")) }
        Mock.services.take(2).forEachIndexed { i, s ->
            item {
                GlassCard(padding = 14.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(l(s.name, s.nameAr), style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk)
                            Text(l("Karim Adel", "كريم عادل"), color = CarColors.TextSecondary, style = MaterialTheme.typography.bodyMedium)
                        }
                        StatusPill(if (done[i]) l("Done", "منجز") else l("Working", "جارٍ"), if (done[i]) CarColors.Teal else CarColors.Amber)
                    }
                    AnimatedVisibility(!done[i]) {
                        Row(Modifier.padding(top = 12.dp)) { CarButton(l("Mark done", "تم الإنجاز"), { done[i] = true }, icon = Icons.Outlined.CheckCircle, tone = CarColors.Teal) }
                    }
                }
            }
        }
    }
}

/* ============================================================================== 13 checkout */

@Composable
fun CheckoutScreen(nav: StationNav) {
    val items = Mock.services.take(2)
    val subtotal = items.sumOf { it.price }
    val tax = subtotal * 14 / 100
    CarPage(title = Screen.Checkout.title(), subtitle = "A-1042 · ق ر ب ٤٥٦٧", onBack = nav::back,
        bottomBar = {
            FloatingActionBar {
                Row(verticalAlignment = Alignment.CenterVertically) { Text(l("Total", "الإجمالي"), color = CarColors.TextSecondary, modifier = Modifier.weight(1f)); BigNumber(money(subtotal + tax), size = 26) }
                CarButton(l("Take payment", "تحصيل المبلغ"), { nav.replace(Screen.Payment) }, icon = Icons.Outlined.CreditCard)
            }
        }) {
        item {
            GlassCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Glyph(Icons.AutoMirrored.Outlined.ReceiptLong); Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) { Text(l("Receipt preview", "معاينة الإيصال"), fontWeight = FontWeight.Bold, color = CarColors.NavyInk); Text("#INV-2026-004812", style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary) }
                }
                HairDivider()
                items.forEach { KeyValue(l(it.name, it.nameAr), money(it.price)) }
                HairDivider()
                KeyValue(l("Subtotal", "المجموع"), money(subtotal))
                KeyValue(l("VAT 14%", "ضريبة ١٤٪"), money(tax))
                KeyValue(l("Total", "الإجمالي"), money(subtotal + tax), strong = true, valueColor = CarColors.Navy)
            }
        }
        item { GlassCard(padding = 8.dp) { ToggleRow(l("Send on WhatsApp", "إرسال على واتساب"), "+20 100 123 4567", icon = Icons.AutoMirrored.Outlined.Chat) } }
    }
}

/* ====================================================================== 14 payment + WhatsApp */

@Composable
fun PaymentScreen(nav: StationNav) {
    var method by remember { mutableIntStateOf(0) }
    var tendered by remember { mutableStateOf("1,500") }
    val total = 1254
    CarPage(title = Screen.Payment.title(), subtitle = "A-1042", onBack = nav::back, bottomBar = { FloatingActionBar { CarButton(l("Confirm payment", "تأكيد الدفع"), { nav.replace(Screen.Paid) }, icon = Icons.Outlined.Check, tone = CarColors.Teal) } }) {
        item { Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) { Text(l("Amount due", "المبلغ المستحق"), color = CarColors.TextSecondary); BigNumber(money(total), size = 40) } }
        item { SegmentedTabs(listOf(l("Cash", "نقدي"), l("Card", "بطاقة"), l("Split", "مقسّم")), method, { method = it }) }
        item {
            GlassCard {
                when (method) {
                    0 -> { SoftField(l("Cash received", "المبلغ المستلم"), tendered, { tendered = it }, icon = Icons.Outlined.Money); Spacer(Modifier.height(10.dp)); KeyValue(l("Change", "الباقي"), money(246), strong = true, valueColor = CarColors.Teal) }
                    1 -> { CarRow(l("Use the POS terminal", "استخدم ماكينة الدفع"), l("Then type the last 4 digits", "ثم اكتب آخر ٤ أرقام"), icon = Icons.Outlined.CreditCard); SoftField(l("Card reference", "مرجع البطاقة"), "", {}, placeholder = "•••• 4821") }
                    else -> { SoftField(l("Cash", "نقدي"), "800", {}, icon = Icons.Outlined.Money); Spacer(Modifier.height(10.dp)); SoftField(l("Card", "بطاقة"), "454", {}, icon = Icons.Outlined.CreditCard); KeyValue(l("Remaining", "المتبقي"), money(0), valueColor = CarColors.Teal) }
                }
            }
        }
        item { GlassCard(padding = 8.dp) { ToggleRow(l("WhatsApp receipt", "إيصال واتساب"), l("Arabic · with your logo", "عربي · بشعارك"), icon = Icons.AutoMirrored.Outlined.Chat) } }
    }
}

/* ================================================================================== 15 paid */

@Composable
fun PaidScreen(nav: StationNav) {
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val pop by animateFloatAsState(if (shown) 1f else 0.3f, spring(dampingRatio = 0.4f, stiffness = Spring.StiffnessLow), label = "pop")
    CarPage(title = Screen.Paid.title(), onBack = nav::back, bottomBar = {
        FloatingActionBar {
            CarButton(l("Next car", "السيارة التالية"), { nav.home(); nav.open(Screen.Scan) }, icon = Icons.Outlined.DirectionsCar)
            GhostButton(l("Share receipt", "مشاركة الإيصال"), {}, Modifier.fillMaxWidth(), icon = Icons.Outlined.Share)
        }
    }) {
        item {
            Column(Modifier.fillMaxWidth().padding(top = 40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.scale(pop)) { Glyph(Icons.Outlined.CheckCircle, size = 128.dp, active = true, tint = CarColors.Teal) }
                Spacer(Modifier.height(18.dp))
                BigNumber(money(1254))
                Text(l("Paid in cash · change 246 EGP", "مدفوع نقداً · الباقي ٢٤٦ ج.م"), color = CarColors.TextSecondary, textAlign = TextAlign.Center)
            }
        }
        item {
            GlassCard(padding = 14.dp) {
                CarRow(l("Receipt sent on WhatsApp", "تم إرسال الإيصال على واتساب"), l("Delivered · 2 seconds ago", "تم التسليم · منذ ثانيتين"), icon = Icons.AutoMirrored.Outlined.Chat) { Icon(Icons.Outlined.Check, null, tint = CarColors.Teal) }
                CarRow("#INV-2026-004812", l("Numbered without gaps", "ترقيم بدون فجوات"), icon = Icons.AutoMirrored.Outlined.ReceiptLong)
            }
        }
    }
}
