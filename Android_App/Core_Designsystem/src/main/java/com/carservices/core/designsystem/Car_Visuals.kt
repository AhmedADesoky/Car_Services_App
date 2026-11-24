package com.carservices.core.designsystem

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.rotate as rotateDraw
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DocumentScanner
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/* ========================================================================== floating navigation */

data class NavItem(val label: String, val icon: ImageVector)

private val BarHeight = 68.dp

/**
 * Floating navigation: a translucent capsule with five evenly spaced tabs. The centre tab is the plate scanner,
 * drawn in the same thin "invisible" line style as the others, set apart by a teal→amber hairline ring and a soft glow.
 */
@Composable
fun FloatingNavBar(items: List<NavItem>, selected: Int, onSelect: (Int) -> Unit, onCenter: () -> Unit, centerLabel: String, modifier: Modifier = Modifier) {
    val half = items.size / 2
    Box(modifier.fillMaxWidth().navigationBarsPadding().padding(start = 14.dp, end = 14.dp, bottom = 12.dp)) {
        Row(
            Modifier.fillMaxWidth().height(BarHeight)
                .shadow(24.dp, CircleShape, ambientColor = CarColors.Navy.copy(alpha = 0.16f), spotColor = CarColors.Navy.copy(alpha = 0.22f))
                .clip(CircleShape).background(Color(0xFFFDFEFF)).border(1.dp, CarColors.Navy.copy(alpha = 0.06f), CircleShape)
                .padding(horizontal = 6.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            items.take(half).forEachIndexed { i, item -> NavTab(item, i == selected) { onSelect(i) } }
            ScanTab(centerLabel, onCenter)
            items.drop(half).forEachIndexed { j, item -> NavTab(item, half + j == selected) { onSelect(half + j) } }
        }
    }
}

@Composable
private fun NavTab(item: NavItem, active: Boolean, onClick: () -> Unit) {
    val tint by animateColorAsState(if (active) CarColors.Teal else CarColors.TextSecondary.copy(alpha = 0.7f), label = "tint")
    val pill by animateFloatAsState(if (active) 1f else 0f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "pill")
    Column(
        Modifier.width(62.dp).height(BarHeight).softClick(onClick).semantics { contentDescription = item.label }.padding(vertical = 9.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
    ) {
        Box(Modifier.width(50.dp).height(30.dp), contentAlignment = Alignment.Center) {
            Box(Modifier.fillMaxSize().graphicsLayer { scaleX = 0.5f + 0.5f * pill; alpha = pill }.clip(CircleShape).background(CarColors.Teal.copy(alpha = 0.12f)))
            Icon(item.icon, null, tint = tint, modifier = Modifier.size(21.dp))
        }
        Spacer(Modifier.height(3.dp))
        Text(item.label, color = tint, fontSize = 10.5.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.Medium, maxLines = 1)
    }
}

/** Centre scanner tab: line-art licence plate inside a gradient hairline ring. Static; one laser sweep on tap. */
@Composable
private fun ScanTab(label: String, onClick: () -> Unit) {
    val scope = rememberCoroutineScope()
    val sweep = remember { Animatable(0f) }
    var pressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (pressed) 0.9f else 1f, spring(dampingRatio = 0.45f), label = "press")
    Column(
        Modifier.width(66.dp).height(BarHeight)
            .pointerInput(Unit) {
                detectTapGestures(
                    onPress = { pressed = true; tryAwaitRelease(); pressed = false },
                    onTap = { scope.launch { sweep.snapTo(0f); sweep.animateTo(1f, tween(380, easing = FastOutSlowInEasing)); sweep.snapTo(0f); onClick() } },
                )
            }
            .semantics { contentDescription = label }.padding(vertical = 9.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
    ) {
        Box(Modifier.width(50.dp).height(30.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.requiredSize(36.dp).graphicsLayer { scaleX = scale; scaleY = scale }) {
            val c = center
            val r = size.minDimension / 2
            // soft glow + gradient hairline ring
            drawCircle(Brush.radialGradient(listOf(CarColors.Teal.copy(alpha = 0.14f), Color.Transparent), c, r), r, c)
            drawCircle(Brush.sweepGradient(listOf(CarColors.Teal, CarColors.TealGlow, CarColors.Amber, CarColors.Teal), c), r - 0.8.dp.toPx(), c, style = Stroke(1.4.dp.toPx()))

            // plate in thin lines
            val pw = r * 1.18f; val ph = r * 0.66f
            val pl = c.x - pw / 2; val pt = c.y - ph / 2
            val stroke = 1.4.dp.toPx()
            drawRoundRect(CarColors.Navy, Offset(pl, pt), Size(pw, ph), CornerRadius(2.5.dp.toPx()), style = Stroke(stroke))
            val bandY = pt + ph * 0.32f
            drawLine(CarColors.Teal, Offset(pl + stroke, bandY), Offset(pl + pw - stroke, bandY), stroke)        // coloured band edge
            drawLine(CarColors.Navy, Offset(c.x, bandY + 2.dp.toPx()), Offset(c.x, pt + ph - 2.dp.toPx()), stroke * 0.85f)  // code | number
            val midY = bandY + (pt + ph - bandY) / 2
            listOf(-1f, 1f).forEach { side ->
                val cx = c.x + side * pw * 0.25f
                drawLine(CarColors.Navy, Offset(cx - pw * 0.11f, midY), Offset(cx + pw * 0.11f, midY), 1.8.dp.toPx(), StrokeCap.Round)
            }

            // laser sweep only while tapped
            if (sweep.value > 0f) {
                val y = pt - 3.dp.toPx() + (ph + 6.dp.toPx()) * sweep.value
                drawLine(CarColors.Teal, Offset(pl - 3.dp.toPx(), y), Offset(pl + pw + 3.dp.toPx(), y), 1.6.dp.toPx(), StrokeCap.Round)
            }
        }
        }
        Spacer(Modifier.height(3.dp))
        Text(label, color = CarColors.Navy, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

/* ================================================================================== charts */

/** Rounded bars that grow in; the highlighted bar is navy, others soft teal. */
@Composable
fun BarChart(values: List<Float>, labels: List<String>, modifier: Modifier = Modifier, highlight: Int = values.lastIndex) {
    val grow = remember { Animatable(0f) }
    LaunchedEffect(values) { grow.snapTo(0f); grow.animateTo(1f, tween(900)) }
    val max = (values.maxOrNull() ?: 1f).coerceAtLeast(1f)
    Box(modifier.fillMaxWidth().height(150.dp)) {
        Canvas(Modifier.fillMaxWidth().height(128.dp)) {
            val slot = size.width / values.size
            val barW = slot * 0.46f
            values.forEachIndexed { i, v ->
                val h = size.height * (v / max) * grow.value
                val color = if (i == highlight) CarColors.Navy else CarColors.Teal.copy(alpha = 0.28f)
                drawRoundRect(color, topLeft = Offset(i * slot + (slot - barW) / 2, size.height - h), size = Size(barW, h), cornerRadius = CornerRadius(barW / 2, barW / 2))
            }
        }
        Row(Modifier.fillMaxWidth().align(Alignment.BottomCenter)) {
            labels.forEach { Text(it, Modifier.weight(1f), color = CarColors.TextSecondary, fontSize = 11.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center) }
        }
    }
}

/** Smooth line with a soft area fill. */
@Composable
fun Sparkline(values: List<Float>, modifier: Modifier = Modifier, color: Color = CarColors.Teal) {
    val reveal = remember { Animatable(0f) }
    LaunchedEffect(values) { reveal.snapTo(0f); reveal.animateTo(1f, tween(1100)) }
    Canvas(modifier.fillMaxWidth().height(70.dp)) {
        if (values.size < 2) return@Canvas
        val max = values.max(); val min = values.min(); val span = (max - min).coerceAtLeast(1f)
        val pts = values.mapIndexed { i, v -> Offset(size.width * i / (values.size - 1), size.height - (v - min) / span * size.height * 0.85f - size.height * 0.05f) }
        val line = Path().apply {
            moveTo(pts[0].x, pts[0].y)
            for (i in 1 until pts.size) {
                val c = (pts[i - 1].x + pts[i].x) / 2
                cubicTo(c, pts[i - 1].y, c, pts[i].y, pts[i].x, pts[i].y)
            }
        }
        val area = Path().apply { addPath(line); lineTo(size.width, size.height); lineTo(0f, size.height); close() }
        clipRect(right = size.width * reveal.value) {
            drawPath(area, Brush.verticalGradient(listOf(color.copy(alpha = 0.22f), Color.Transparent)))
            drawPath(line, color, style = Stroke(2.5.dp.toPx(), cap = StrokeCap.Round))
        }
    }
}

/** Progress ring with a centre slot (shift progress, plan usage). */
@Composable
fun RingProgress(progress: Float, modifier: Modifier = Modifier, size: Dp = 92.dp, stroke: Dp = 8.dp, color: Color = CarColors.Teal, track: Color = CarColors.Navy.copy(alpha = 0.07f), content: @Composable BoxScope.() -> Unit = {}) {
    val p by animateFloatAsState(progress.coerceIn(0f, 1f), tween(1000), label = "ring")
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val s = stroke.toPx()
            drawArc(track, 0f, 360f, false, topLeft = Offset(s / 2, s / 2), size = Size(this.size.width - s, this.size.height - s), style = Stroke(s))
            drawArc(color, -90f, 360f * p, false, topLeft = Offset(s / 2, s / 2), size = Size(this.size.width - s, this.size.height - s), style = Stroke(s, cap = StrokeCap.Round))
        }
        content()
    }
}

/** Horizontal meter (seat usage, scans quota). */
@Composable
fun MeterBar(progress: Float, modifier: Modifier = Modifier, color: Color = CarColors.Teal) {
    val p by animateFloatAsState(progress.coerceIn(0f, 1f), tween(900), label = "meter")
    Box(modifier.fillMaxWidth().height(8.dp).clip(CircleShape).background(CarColors.Navy.copy(alpha = 0.07f))) {
        Box(Modifier.fillMaxWidth(p).height(8.dp).clip(CircleShape).background(Brush.horizontalGradient(listOf(color.copy(alpha = 0.7f), color))))
    }
}

/* =============================================================================== camera mock */

/**
 * Dark camera viewfinder (UI only - CameraX plugs in later): corner brackets, a sweeping scan line
 * and an overlay slot for the frame guide (plate rectangle or face oval).
 */
@Composable
fun CameraViewfinder(modifier: Modifier = Modifier, oval: Boolean = false, accent: Color = CarColors.TealGlow, overlay: @Composable BoxScope.() -> Unit = {}) {
    val sweep = rememberInfiniteTransition(label = "scan")
    val y by sweep.animateFloat(0.15f, 0.85f, infiniteRepeatable(tween(1800, easing = LinearEasing), RepeatMode.Reverse), label = "y")
    Box(
        modifier.fillMaxWidth().clip(RoundedCornerShape(30.dp))
            .background(Brush.radialGradient(listOf(Color(0xFF1C3350), Color(0xFF060F1C)))),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val w = size.width; val h = size.height
            if (oval) {
                val ow = w * 0.55f; val oh = ow * 1.3f
                drawOval(accent.copy(alpha = 0.9f), topLeft = Offset((w - ow) / 2, (h - oh) / 2), size = Size(ow, oh), style = Stroke(2.dp.toPx()))
                drawOval(accent.copy(alpha = 0.12f), topLeft = Offset((w - ow) / 2, (h - oh) / 2), size = Size(ow, oh))
            } else {
                val bw = w * 0.72f; val bh = bw * 0.36f; val l = (w - bw) / 2; val t = (h - bh) / 2; val c = 26.dp.toPx(); val s = 3.dp.toPx()
                listOf(Offset(l, t) to Pair(1f, 1f), Offset(l + bw, t) to Pair(-1f, 1f), Offset(l, t + bh) to Pair(1f, -1f), Offset(l + bw, t + bh) to Pair(-1f, -1f)).forEach { (o, d) ->
                    drawLine(accent, o, Offset(o.x + c * d.first, o.y), s, StrokeCap.Round)
                    drawLine(accent, o, Offset(o.x, o.y + c * d.second), s, StrokeCap.Round)
                }
            }
            drawRect(Brush.verticalGradient(listOf(Color.Transparent, accent.copy(alpha = 0.35f), Color.Transparent), startY = h * y - 30, endY = h * y + 30), topLeft = Offset(0f, h * y - 30), size = Size(w, 60f))
        }
        overlay()
    }
}

/** Little "live" dot that pulses (recording, online, timer running). */
@Composable
fun LiveDot(color: Color = CarColors.Teal, modifier: Modifier = Modifier) {
    val t = rememberInfiniteTransition(label = "live")
    val a by t.animateFloat(0.3f, 1f, infiniteRepeatable(tween(800), RepeatMode.Reverse), label = "a")
    Box(modifier.size(8.dp).background(color.copy(alpha = a), CircleShape))
}

@Composable
fun BigNumber(text: String, color: Color = CarColors.Navy, size: Int = 34) =
    Text(text, color = color, fontSize = size.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.8).sp)
