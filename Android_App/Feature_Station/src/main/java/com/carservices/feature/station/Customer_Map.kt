package com.carservices.feature.station

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.carservices.core.designsystem.Avatar
import com.carservices.core.designsystem.CarColors
import com.carservices.core.designsystem.CarPage
import com.carservices.core.designsystem.CarRow
import com.carservices.core.designsystem.KuwaitPlate
import com.carservices.core.designsystem.GlassCard
import com.carservices.core.designsystem.GlassIconButton
import com.carservices.core.designsystem.KeyValue
import com.carservices.core.designsystem.PillTabs
import com.carservices.core.designsystem.SectionTitle
import com.carservices.core.designsystem.StatusPill
import com.carservices.core.designsystem.l

private enum class PartState(val en: String, val ar: String, val color: Color) {
    Ok("No record", "لا يوجد سجل", CarColors.Navy.copy(alpha = 0.06f)), Repaired("Repaired", "تم الإصلاح", CarColors.Teal),
    Replaced("Replaced", "تم الاستبدال", CarColors.Navy), Attention("Needs attention", "يحتاج متابعة", CarColors.Orange),
}

/** A tappable part of the top-view car, in fractions of the drawing box. */
private data class CarPart(val en: String, val ar: String, val box: Rect, val state: PartState, val note: String, val noteAr: String)

private val parts = listOf(
    CarPart("Front bumper", "الصدام الأمامي", Rect(0.22f, 0.02f, 0.78f, 0.09f), PartState.Ok, "", ""),
    CarPart("Hood / engine", "الكبوت / المحرك", Rect(0.24f, 0.10f, 0.76f, 0.30f), PartState.Repaired, "Oil change + filter · 12 Oct", "تغيير زيت + فلتر · ١٢ أكتوبر"),
    CarPart("Front-left wheel", "العجلة الأمامية اليسرى", Rect(0.06f, 0.14f, 0.20f, 0.28f), PartState.Replaced, "Front brake pads · 3 Aug", "فحمات فرامل أمامية · ٣ أغسطس"),
    CarPart("Front-right wheel", "العجلة الأمامية اليمنى", Rect(0.80f, 0.14f, 0.94f, 0.28f), PartState.Replaced, "Front brake pads · 3 Aug", "فحمات فرامل أمامية · ٣ أغسطس"),
    CarPart("Windscreen", "الزجاج الأمامي", Rect(0.27f, 0.31f, 0.73f, 0.39f), PartState.Ok, "", ""),
    CarPart("Left doors", "الأبواب اليسرى", Rect(0.20f, 0.40f, 0.28f, 0.70f), PartState.Ok, "", ""),
    CarPart("Cabin / AC", "المقصورة / التكييف", Rect(0.29f, 0.40f, 0.71f, 0.70f), PartState.Repaired, "AC recharge · 19 Jun", "شحن تكييف · ١٩ يونيو"),
    CarPart("Right doors", "الأبواب اليمنى", Rect(0.72f, 0.40f, 0.80f, 0.70f), PartState.Ok, "", ""),
    CarPart("Rear-left wheel", "العجلة الخلفية اليسرى", Rect(0.06f, 0.70f, 0.20f, 0.84f), PartState.Attention, "Rear pads at 30% · check next visit", "الفحمات الخلفية ٣٠٪ · افحص الزيارة القادمة"),
    CarPart("Rear-right wheel", "العجلة الخلفية اليمنى", Rect(0.80f, 0.70f, 0.94f, 0.84f), PartState.Attention, "Rear pads at 30% · check next visit", "الفحمات الخلفية ٣٠٪ · افحص الزيارة القادمة"),
    CarPart("Trunk", "الشنطة", Rect(0.25f, 0.76f, 0.75f, 0.90f), PartState.Ok, "", ""),
    CarPart("Rear bumper", "الصدام الخلفي", Rect(0.22f, 0.91f, 0.78f, 0.98f), PartState.Replaced, "Bumper replaced · 2024", "تم استبدال الصدام · ٢٠٢٤"),
)

/* ======================================================================== 22 customer profile */

@Composable
fun CustomerProfileScreen(nav: StationNav) {
    var car by remember { mutableIntStateOf(0) }
    var selected by remember { mutableStateOf(parts[8]) }
    CarPage(title = "Abdullah Al-Mutairi", subtitle = l("Customer since 2023", "عميل منذ ٢٠٢٣"), onBack = nav::back,
        actions = { GlassIconButton(Icons.AutoMirrored.Outlined.Chat, "WhatsApp", {}); GlassIconButton(Icons.Outlined.Phone, l("Call", "اتصال"), {}) }) {
        item {
            GlassCard(padding = 14.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Avatar("Abdullah Al-Mutairi", size = 52.dp)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) { Text("+965 9876 5432", color = CarColors.NavyInk, fontWeight = FontWeight.SemiBold); Text(l("14 visits · 552.500 KWD", "١٤ زيارة · ٥٥٢٫٥٠٠ د.ك"), color = CarColors.TextSecondary, style = MaterialTheme.typography.bodyMedium) }
                    StatusPill(l("WhatsApp on", "واتساب مفعّل"), CarColors.Teal)
                }
            }
        }
        item { PillTabs(listOf("Land Cruiser · 12 / 34567", "Patrol · 5 / 8812"), car, { car = it }) }
        item {
            GlassCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(l("Service map", "خريطة الخدمة"), style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk, modifier = Modifier.weight(1f))
                    KuwaitPlate("12", "34567", scale = 0.42f)
                }
                Spacer(Modifier.height(8.dp))
                CarMap(selected) { selected = it }
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                    listOf(PartState.Repaired, PartState.Replaced, PartState.Attention).forEach { s ->
                        Row(verticalAlignment = Alignment.CenterVertically) { Dot(s.color); Spacer(Modifier.width(6.dp)); Text(l(s.en, s.ar), style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary) }
                    }
                }
            }
        }
        item {
            AnimatedContent(selected, transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(150)) }, label = "part") { part ->
                GlassCard(padding = 14.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(l(part.en, part.ar), style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk, modifier = Modifier.weight(1f))
                        StatusPill(l(part.state.en, part.state.ar), if (part.state == PartState.Ok) CarColors.Outline else part.state.color)
                    }
                    if (part.note.isNotEmpty()) CarRow(l(part.note, part.noteAr), l("by Karim Adel", "بواسطة كريم عادل"), icon = Icons.Outlined.Build)
                    else Text(l("Nothing recorded for this part yet.", "لا يوجد سجل لهذا الجزء بعد."), color = CarColors.TextSecondary, modifier = Modifier.padding(top = 8.dp))
                }
            }
        }
        item { SectionTitle(l("Visits", "الزيارات"), action = l("History", "السجل")) { nav.open(Screen.History) } }
        item { GlassCard { KeyValue(l("Last visit", "آخر زيارة"), l("Today", "اليوم")); KeyValue(l("Average bill", "متوسط الفاتورة"), money(41500)); KeyValue(l("Favourite service", "الخدمة المفضلة"), l("Oil change", "تغيير زيت")) } }
    }
}

/** Top-view car drawn on a Canvas; 12 tappable zones, "needs attention" parts pulse. */
@Composable
private fun CarMap(selected: CarPart, onSelect: (CarPart) -> Unit) {
    val pulse = rememberInfiniteTransition(label = "pulse")
    val a by pulse.animateFloat(0.35f, 0.95f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "a")
    Box(Modifier.fillMaxWidth().height(380.dp), contentAlignment = Alignment.Center) {
        Canvas(
            Modifier.width(230.dp).height(380.dp).pointerInput(Unit) {
                detectTapGestures { tap ->
                    val fx = tap.x / size.width; val fy = tap.y / size.height
                    parts.lastOrNull { it.box.contains(Offset(fx, fy)) }?.let(onSelect)
                }
            },
        ) {
            val w = size.width; val h = size.height
            fun r(p: Rect) = Rect(p.left * w, p.top * h, p.right * w, p.bottom * h)
            // body silhouette
            drawRoundRect(CarColors.Navy.copy(alpha = 0.04f), Offset(w * 0.18f, h * 0.02f), Size(w * 0.64f, h * 0.96f), CornerRadius(w * 0.2f, w * 0.2f))
            drawRoundRect(CarColors.Navy.copy(alpha = 0.25f), Offset(w * 0.18f, h * 0.02f), Size(w * 0.64f, h * 0.96f), CornerRadius(w * 0.2f, w * 0.2f), style = Stroke(1.5.dp.toPx()))
            parts.forEach { p ->
                val rect = r(p.box)
                val base = when (p.state) { PartState.Ok -> CarColors.Navy.copy(alpha = 0.05f); PartState.Attention -> p.state.color.copy(alpha = 0.25f * a + 0.1f); else -> p.state.color.copy(alpha = 0.22f) }
                val radius = CornerRadius(10.dp.toPx(), 10.dp.toPx())
                drawRoundRect(base, rect.topLeft, rect.size, radius)
                val outline = if (p == selected) CarColors.Navy else if (p.state == PartState.Ok) CarColors.Navy.copy(alpha = 0.12f) else p.state.color.copy(alpha = 0.7f)
                drawRoundRect(outline, rect.topLeft, rect.size, radius, style = Stroke((if (p == selected) 2.5f else 1.2f).dp.toPx()))
            }
        }
    }
}
