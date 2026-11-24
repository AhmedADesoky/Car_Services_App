package com.carservices.core.designsystem

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.RemoveRedEye
import androidx.compose.material.icons.outlined.CenterFocusStrong
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.rotate as rotateDraw
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.cos
import kotlin.math.sin

enum class FaceScanState { Idle, Scanning, Verifying, Success, Failed }
enum class FaceCue { Look, Blink, TurnLeft, TurnRight, Hold }

/* Normalised landmark polylines for the wireframe face (x, y in 0..1 of the face circle). */
private val Jaw = listOf(0.22f to 0.38f, 0.23f to 0.50f, 0.27f to 0.62f, 0.34f to 0.73f, 0.42f to 0.80f, 0.50f to 0.82f, 0.58f to 0.80f, 0.66f to 0.73f, 0.73f to 0.62f, 0.77f to 0.50f, 0.78f to 0.38f)
private val Brow = listOf(0.22f to 0.38f, 0.30f to 0.24f, 0.40f to 0.18f, 0.50f to 0.16f, 0.60f to 0.18f, 0.70f to 0.24f, 0.78f to 0.38f)
private val BrowL = listOf(0.29f to 0.36f, 0.36f to 0.32f, 0.44f to 0.35f)
private val BrowR = listOf(0.56f to 0.35f, 0.64f to 0.32f, 0.71f to 0.36f)
private val EyeL = listOf(0.31f to 0.43f, 0.37f to 0.40f, 0.43f to 0.43f, 0.37f to 0.46f, 0.31f to 0.43f)
private val EyeR = listOf(0.57f to 0.43f, 0.63f to 0.40f, 0.69f to 0.43f, 0.63f to 0.46f, 0.57f to 0.43f)
private val Nose = listOf(0.50f to 0.40f, 0.50f to 0.52f, 0.45f to 0.58f, 0.50f to 0.60f, 0.55f to 0.58f, 0.50f to 0.52f)
private val Mouth = listOf(0.40f to 0.68f, 0.46f to 0.66f, 0.50f to 0.67f, 0.54f to 0.66f, 0.60f to 0.68f, 0.50f to 0.72f, 0.40f to 0.68f)
private val Mesh = listOf( // triangulation lines that give the "scanned mesh" look
    (0.37f to 0.40f) to (0.50f to 0.40f), (0.63f to 0.40f) to (0.50f to 0.40f), (0.43f to 0.43f) to (0.45f to 0.58f), (0.57f to 0.43f) to (0.55f to 0.58f),
    (0.31f to 0.43f) to (0.27f to 0.62f), (0.69f to 0.43f) to (0.73f to 0.62f), (0.45f to 0.58f) to (0.40f to 0.68f), (0.55f to 0.58f) to (0.60f to 0.68f),
    (0.40f to 0.68f) to (0.34f to 0.73f), (0.60f to 0.68f) to (0.66f to 0.73f), (0.50f to 0.72f) to (0.50f to 0.82f), (0.36f to 0.32f) to (0.40f to 0.18f),
    (0.64f to 0.32f) to (0.60f to 0.18f), (0.50f to 0.40f) to (0.50f to 0.16f), (0.27f to 0.62f) to (0.45f to 0.58f), (0.73f to 0.62f) to (0.55f to 0.58f),
)

/**
 * Professional face-verification viewfinder (UI only - CameraX + the face/liveness engines plug in later):
 * - circular frame with 96 tick marks that fill as `progress` grows (Face-ID style enrolment ring)
 * - wireframe landmark mesh inside the circle, a scan beam while scanning
 * - success / failure states recolour the ring and pop a badge in the centre
 */
@Composable
fun FaceScanner(progress: Float, state: FaceScanState, modifier: Modifier = Modifier, light: Boolean = false) {
    val p by animateFloatAsState(progress.coerceIn(0f, 1f), tween(700, easing = FastOutSlowInEasing), label = "p")
    val accent by animateColorAsState(
        when (state) { FaceScanState.Success -> Color(0xFF5FE0B0); FaceScanState.Failed -> CarColors.Orange; else -> CarColors.TealGlow }, tween(500), label = "accent",
    )
    // colour for things drawn on the page (ring, comet, readout): deeper teal on light paper
    val ring by animateColorAsState(
        when {
            !light -> accent
            state == FaceScanState.Success -> Color(0xFF12A37A)
            state == FaceScanState.Failed -> CarColors.Orange
            else -> CarColors.Teal
        }, tween(500), label = "ring",
    )
    val idleTick = if (light) CarColors.Navy.copy(alpha = 0.10f) else Color.White.copy(alpha = 0.16f)
    val cornerColor = if (light) CarColors.Navy.copy(alpha = 0.22f) else Color.White.copy(alpha = 0.35f)
    val loop = rememberInfiniteTransition(label = "scan")
    val beam by loop.animateFloat(0f, 1f, infiniteRepeatable(tween(2200, easing = LinearEasing), RepeatMode.Reverse), label = "beam")
    val sweep by loop.animateFloat(0f, 360f, infiniteRepeatable(tween(2600, easing = LinearEasing)), label = "sweep")
    val breathe by loop.animateFloat(0.35f, 1f, infiniteRepeatable(tween(1300), RepeatMode.Reverse), label = "breathe")
    val meshAlpha by animateFloatAsState(if (state == FaceScanState.Success) 0.15f else 1f, tween(600), label = "mesh")
    val active = state == FaceScanState.Scanning || state == FaceScanState.Verifying

    Box(modifier.fillMaxWidth().aspectRatio(1f), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val c = center
            val outer = size.minDimension / 2f * 0.96f
            val face = outer * 0.74f

            // soft halo
            drawCircle(Brush.radialGradient(listOf(ring.copy(alpha = if (light) 0.10f else 0.16f), Color.Transparent), c, outer * 1.05f), outer * 1.05f, c)

            // tick ring
            val ticks = 96
            for (i in 0 until ticks) {
                val a = Math.toRadians((i * 360.0 / ticks) - 90.0)
                val lit = i.toFloat() / ticks < p
                val near = active && !lit && i.toFloat() / ticks < p + 0.04f
                val len = if (lit) outer * 0.13f else outer * 0.08f
                val r1 = outer - len
                val color = when {
                    lit -> ring
                    near -> ring.copy(alpha = 0.55f * breathe)
                    else -> idleTick
                }
                drawLine(color, Offset(c.x + cos(a).toFloat() * r1, c.y + sin(a).toFloat() * r1), Offset(c.x + cos(a).toFloat() * outer, c.y + sin(a).toFloat() * outer),
                    strokeWidth = if (lit) 3.2.dp.toPx() else 2.dp.toPx(), cap = StrokeCap.Round)
            }

            // comet sweeping around the face circle while working
            if (active) {
                rotateDraw(sweep, c) {
                    drawArc(Brush.sweepGradient(listOf(Color.Transparent, ring.copy(alpha = 0.0f), ring.copy(alpha = 0.9f)), c), -90f, 80f, false,
                        topLeft = Offset(c.x - face, c.y - face), size = Size(face * 2, face * 2), style = Stroke(2.5.dp.toPx(), cap = StrokeCap.Round))
                }
            }
            // face circle (the camera lens)
            if (light) { drawCircle(Color.White, face + 9.dp.toPx(), c); drawCircle(CarColors.Navy.copy(alpha = 0.08f), face + 9.dp.toPx(), c, style = Stroke(1.dp.toPx())) }
            drawCircle(Color(0xFF0A1C33).copy(alpha = 0.85f), face, c)
            drawCircle(accent.copy(alpha = 0.35f), face, c, style = Stroke(1.dp.toPx()))

            // inside the face circle: mesh + beam
            val clip = Path().apply { addOval(androidx.compose.ui.geometry.Rect(c, face)) }
            clipPath(clip) {
                drawCircle(Brush.radialGradient(listOf(accent.copy(alpha = 0.12f), Color.Transparent), c, face), face, c)
                val box = face * 2f
                val o = Offset(c.x - face, c.y - face)
                fun pt(xy: Pair<Float, Float>) = Offset(o.x + xy.first * box, o.y + xy.second * box)
                val lineColor = accent.copy(alpha = 0.32f * meshAlpha)
                Mesh.forEach { (a, b) -> drawLine(lineColor.copy(alpha = 0.18f * meshAlpha), pt(a), pt(b), 1.dp.toPx()) }
                listOf(Jaw, Brow, BrowL, BrowR, EyeL, EyeR, Nose, Mouth).forEach { line ->
                    for (i in 1 until line.size) drawLine(lineColor, pt(line[i - 1]), pt(line[i]), 1.3.dp.toPx(), StrokeCap.Round)
                }
                (Jaw + Brow + BrowL + BrowR + EyeL + EyeR + Nose + Mouth).distinct().forEachIndexed { i, xy ->
                    val twinkle = if (active) (0.45f + 0.55f * ((breathe + i * 0.13f) % 1f)) else 0.8f
                    drawCircle(accent.copy(alpha = twinkle * meshAlpha), 2.2.dp.toPx(), pt(xy))
                }
                if (active) {
                    val y = o.y + box * (0.1f + 0.8f * beam)
                    drawRect(Brush.verticalGradient(listOf(Color.Transparent, accent.copy(alpha = 0.28f), Color.Transparent), y - 36f, y + 36f), Offset(o.x, y - 36f), Size(box, 72f))
                    drawLine(accent.copy(alpha = 0.85f), Offset(o.x, y), Offset(o.x + box, y), 1.4.dp.toPx())
                }
            }

            // four minimal corner marks framing the whole scanner
            val m = outer * 1.0f; val k = outer * 0.16f; val s = 2.dp.toPx()
            listOf(-1f to -1f, 1f to -1f, -1f to 1f, 1f to 1f).forEach { (dx, dy) ->
                val corner = Offset(c.x + dx * m, c.y + dy * m)
                drawLine(cornerColor, corner, Offset(corner.x - dx * k, corner.y), s, StrokeCap.Round)
                drawLine(cornerColor, corner, Offset(corner.x, corner.y - dy * k), s, StrokeCap.Round)
            }
        }

        // centre badges
        AnimatedVisibility(state == FaceScanState.Success || state == FaceScanState.Failed, enter = scaleIn(spring(dampingRatio = 0.45f, stiffness = Spring.StiffnessMediumLow)) + fadeIn(), exit = fadeOut()) {
            Box(Modifier.size(84.dp).clip(CircleShape).background(accent), contentAlignment = Alignment.Center) {
                Icon(if (state == FaceScanState.Failed) Icons.Outlined.Close else Icons.Outlined.Check, null, tint = CarColors.Navy, modifier = Modifier.size(44.dp))
            }
        }
        AnimatedVisibility(state == FaceScanState.Verifying, enter = fadeIn(), exit = fadeOut()) {
            CircularProgressIndicator(Modifier.size(54.dp), color = accent, strokeWidth = 2.5.dp, trackColor = Color.White.copy(alpha = 0.08f))
        }
        // percentage readout
        Text(
            "${(p * 100).toInt()}%", color = ring, fontFamily = FontFamily.Monospace, fontSize = 12.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.align(Alignment.BottomEnd).padding(end = 6.dp, bottom = 22.dp),
        )
    }
}

/** Instruction line under the scanner with an animated cue icon (look, blink, turn). */
@Composable
fun FaceCueLine(cue: FaceCue, text: String, modifier: Modifier = Modifier, light: Boolean = false) {
    val cueColor = if (light) CarColors.Teal else CarColors.TealGlow
    val t = rememberInfiniteTransition(label = "cue")
    val nudge by t.animateFloat(0f, 1f, infiniteRepeatable(tween(700), RepeatMode.Reverse), label = "n")
    AnimatedContent(cue to text, transitionSpec = { (slideInVertically { it / 2 } + fadeIn()) togetherWith (slideOutVertically { -it / 2 } + fadeOut()) }, label = "cueText", modifier = modifier) { (c, label) ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            val icon: ImageVector = when (c) { FaceCue.Blink -> Icons.Outlined.RemoveRedEye; FaceCue.TurnLeft, FaceCue.TurnRight -> Icons.AutoMirrored.Outlined.ArrowBack; else -> Icons.Outlined.CenterFocusStrong }
            val dx = when (c) { FaceCue.TurnLeft -> -6f * nudge; FaceCue.TurnRight -> 6f * nudge; else -> 0f }
            Box(Modifier.size(34.dp).clip(CircleShape).border(1.dp, cueColor.copy(alpha = 0.4f), CircleShape), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = cueColor, modifier = Modifier.size(18.dp).offset(x = dx.dp).rotate(if (c == FaceCue.TurnRight) 180f else 0f)
                    .graphicsLayer(scaleY = if (c == FaceCue.Blink) 1f - 0.75f * nudge else 1f))
            }
            Spacer(Modifier.width(12.dp))
            Text(label, color = if (light) CarColors.Navy else Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Small glass status chip used over the dark scanner screen. */
@Composable
fun ScanChip(text: String, dot: Color, modifier: Modifier = Modifier, live: Boolean = false, light: Boolean = false) {
    Row(modifier.clip(CircleShape).background(if (light) Color.White.copy(alpha = 0.85f) else Color.White.copy(alpha = 0.06f)).border(1.dp, if (light) CarColors.Navy.copy(alpha = 0.07f) else Color.White.copy(alpha = 0.10f), CircleShape).padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically) {
        if (live) LiveDot(dot) else Box(Modifier.size(7.dp).clip(CircleShape).background(dot))
        Spacer(Modifier.width(7.dp))
        Text(text, color = if (light) CarColors.TextTertiary else Color.White.copy(alpha = 0.85f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.4.sp)
    }
}

enum class CheckStatus { Waiting, Working, Passed, Failed }

/** One verification line: icon ring, title, detail, and an animated status on the end. */
@Composable
fun VerifyRow(title: String, detail: String, icon: ImageVector, status: CheckStatus) {
    val tint by animateColorAsState(when (status) { CheckStatus.Passed -> CarColors.Teal; CheckStatus.Failed -> CarColors.Orange; else -> CarColors.Outline }, label = "vr")
    Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
        Glyph(icon, size = 40.dp, tint = tint, active = status == CheckStatus.Passed)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = CarColors.NavyInk, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            Text(detail, color = CarColors.TextSecondary, fontSize = 12.5.sp)
        }
        AnimatedContent(status, label = "status") { s ->
            when (s) {
                CheckStatus.Working -> CircularProgressIndicator(Modifier.size(20.dp), color = CarColors.Teal, strokeWidth = 2.dp)
                CheckStatus.Passed -> Box(Modifier.size(26.dp).clip(CircleShape).background(CarColors.Teal), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Check, null, tint = Color.White, modifier = Modifier.size(16.dp)) }
                CheckStatus.Failed -> Box(Modifier.size(26.dp).clip(CircleShape).background(CarColors.Orange), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Close, null, tint = Color.White, modifier = Modifier.size(16.dp)) }
                CheckStatus.Waiting -> Box(Modifier.size(26.dp).clip(CircleShape).border(1.5.dp, CarColors.Divider, CircleShape))
            }
        }
    }
}

/** Rounded strip of step dots (prompt progress). */
@Composable
fun CueDots(count: Int, current: Int, modifier: Modifier = Modifier, light: Boolean = false) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        repeat(count) { i ->
            val w by animateFloatAsState(if (i == current) 22f else 7f, label = "dot")
            Box(Modifier.width(w.dp).height(7.dp).clip(RoundedCornerShape(50)).background(if (i <= current) (if (light) CarColors.Teal else CarColors.TealGlow) else (if (light) CarColors.Navy.copy(alpha = 0.10f) else Color.White.copy(alpha = 0.18f))))
        }
    }
}
