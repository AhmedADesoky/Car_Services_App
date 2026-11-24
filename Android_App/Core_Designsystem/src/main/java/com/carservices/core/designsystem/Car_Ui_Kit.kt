package com.carservices.core.designsystem

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/* ============================================================================================
 * GarageOS mobile UI kit - same language as the public website:
 * paper background with soft teal / amber glows, glass cards with hairline borders,
 * "invisible" icons (thin glyph in a hairline ring), floating capsule navigation.
 * ========================================================================================== */

val CardShape = RoundedCornerShape(26.dp)
private val Hairline = CarColors.Navy.copy(alpha = 0.07f)

/** Paper background with two soft radial glows (no blur API needed, works from API 26). */
fun Modifier.paperBackground(dark: Boolean = false): Modifier = this.drawBehind {
    drawRect(if (dark) CarColors.Navy else CarColors.Background)
    drawCircle(
        Brush.radialGradient(listOf(CarColors.Teal.copy(alpha = if (dark) 0.35f else 0.10f), Color.Transparent), center = Offset(size.width * 1.05f, size.height * 0.02f), radius = size.width * 0.85f),
        radius = size.width * 0.85f, center = Offset(size.width * 1.05f, size.height * 0.02f),
    )
    drawCircle(
        Brush.radialGradient(listOf(CarColors.Amber.copy(alpha = if (dark) 0.18f else 0.08f), Color.Transparent), center = Offset(-size.width * 0.1f, size.height * 0.75f), radius = size.width * 0.8f),
        radius = size.width * 0.8f, center = Offset(-size.width * 0.1f, size.height * 0.75f),
    )
}

/** Click without the grey ripple box: interaction stays "invisible", feedback comes from motion. */
fun Modifier.softClick(onClick: () -> Unit): Modifier = this.clickable(interactionSource = MutableInteractionSource(), indication = null, onClick = onClick)

/* ----------------------------------------------------------------------------- page scaffold */

/**
 * Standard screen: transparent top bar that starts below the camera / status bar, then a lazy list.
 * Bottom padding leaves room for the floating navigation capsule.
 */
@Composable
fun CarPage(
    title: String,
    subtitle: String? = null,
    onBack: (() -> Unit)? = null,
    dark: Boolean = false,
    actions: @Composable RowScope.() -> Unit = {},
    bottomBar: (@Composable BoxScope.() -> Unit)? = null,
    content: LazyListScope.() -> Unit,
) {
    // Measure the fixed bottom area so the last list item always ends above it, whatever its height.
    val density = LocalDensity.current
    var barHeight by remember { mutableIntStateOf(0) }
    val listBottom = if (bottomBar != null) with(density) { barHeight.toDp() } + 16.dp else 130.dp
    Box(Modifier.fillMaxSize().paperBackground(dark)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 6.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                if (onBack != null) {
                    GlassIconButton(Icons.AutoMirrored.Outlined.ArrowBack, l("Back", "رجوع"), onBack, dark = dark)
                    Spacer(Modifier.width(10.dp))
                } else Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.labelMedium, color = if (dark) CarColors.TealGlow else CarColors.Teal, maxLines = 1)
                    Text(title, style = MaterialTheme.typography.headlineSmall, color = if (dark) Color.White else CarColors.Navy, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, content = actions)
            }
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 10.dp, bottom = listBottom),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                content = content,
            )
        }
        if (bottomBar != null) Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().onSizeChanged { barHeight = it.height }, content = bottomBar)
    }
}

/** Round glass button for top bars. */
@Composable
fun GlassIconButton(icon: ImageVector, description: String, onClick: () -> Unit, dark: Boolean = false, badge: Boolean = false) {
    Box(
        Modifier.size(44.dp).clip(CircleShape)
            .background(if (dark) Color.White.copy(alpha = 0.08f) else Color.White.copy(alpha = 0.75f))
            .border(1.dp, if (dark) Color.White.copy(alpha = 0.12f) else Hairline, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, description, tint = if (dark) Color.White else CarColors.Navy, modifier = Modifier.size(20.dp))
        if (badge) Box(Modifier.align(Alignment.TopEnd).padding(10.dp).size(8.dp).background(CarColors.Orange, CircleShape).border(1.5.dp, Color.White, CircleShape))
    }
}

/* ----------------------------------------------------------------------------------- surfaces */

/** Glass card: translucent white, hairline border, very soft shadow. */
@Composable
fun GlassCard(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, padding: Dp = 18.dp, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier
            .shadow(18.dp, CardShape, ambientColor = CarColors.Navy.copy(alpha = 0.08f), spotColor = CarColors.Navy.copy(alpha = 0.10f))
            .clip(CardShape)
            .background(Color.White.copy(alpha = 0.92f))
            .border(1.dp, Hairline, CardShape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(padding),
        content = content,
    )
}

/** Deep navy hero card with a teal glow, like the website hero. */
@Composable
fun NavyCard(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier
            .shadow(24.dp, CardShape, spotColor = CarColors.Navy.copy(alpha = 0.4f))
            .clip(CardShape)
            .drawBehind {
                drawRect(Brush.linearGradient(listOf(CarColors.Navy, Color(0xFF071A30))))
                drawCircle(Brush.radialGradient(listOf(CarColors.Teal.copy(alpha = 0.45f), Color.Transparent), center = Offset(size.width, 0f), radius = size.width * 0.7f), radius = size.width * 0.7f, center = Offset(size.width, 0f))
            }
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(20.dp),
        content = content,
    )
}

/* -------------------------------------------------------------------------------------- icons */

/**
 * "Invisible" icon: thin glyph inside a hairline ring with a faint inner glow - no solid tile.
 * Same recipe as `Glyph.tsx` on the website.
 */
@Composable
fun Glyph(icon: ImageVector, modifier: Modifier = Modifier, size: Dp = 42.dp, dark: Boolean = false, active: Boolean = false, tint: Color? = null) {
    val ring by animateColorAsState(
        when {
            active && dark -> CarColors.Amber.copy(alpha = 0.7f)
            active -> CarColors.Teal.copy(alpha = 0.55f)
            dark -> Color.White.copy(alpha = 0.16f)
            else -> CarColors.Navy.copy(alpha = 0.10f)
        }, label = "ring",
    )
    val color = tint ?: when {
        active && dark -> CarColors.Amber
        active -> CarColors.Navy
        dark -> CarColors.TealGlow
        else -> CarColors.Teal
    }
    Box(
        modifier.size(size).drawBehind {
            drawCircle(Brush.radialGradient(listOf(color.copy(alpha = 0.14f), Color.Transparent), center = Offset(this.size.width * 0.3f, this.size.height * 0.25f), radius = this.size.width * 0.7f))
        }.border(1.dp, ring, CircleShape),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, null, tint = color, modifier = Modifier.size(size * 0.46f)) }
}

@Composable
fun Avatar(name: String, modifier: Modifier = Modifier, size: Dp = 44.dp, tone: Color = CarColors.Teal) {
    val initials = name.split(' ').filter { it.isNotBlank() }.take(2).joinToString("") { it.take(1) }.uppercase()
    Box(modifier.size(size).clip(CircleShape).background(tone.copy(alpha = 0.10f)).border(1.dp, tone.copy(alpha = 0.25f), CircleShape), contentAlignment = Alignment.Center) {
        Text(initials, color = tone, fontWeight = FontWeight.Bold, fontSize = (size.value * 0.34f).sp)
    }
}

/* ------------------------------------------------------------------------------------ text bits */

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier, action: String? = null, onAction: () -> Unit = {}) {
    Row(modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text.uppercase(), style = MaterialTheme.typography.labelMedium.copy(letterSpacing = 1.4.sp), color = CarColors.TextSecondary, modifier = Modifier.weight(1f))
        if (action != null) Text(action, style = MaterialTheme.typography.labelMedium, color = CarColors.Teal, modifier = Modifier.softClick(onAction).padding(4.dp))
    }
}

/** Small rounded status label. */
@Composable
fun StatusPill(text: String, color: Color, modifier: Modifier = Modifier) {
    Row(modifier.clip(CircleShape).background(color.copy(alpha = 0.10f)).padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(6.dp).background(color, CircleShape))
        Spacer(Modifier.width(6.dp))
        Text(text, color = color, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
fun KeyValue(label: String, value: String, strong: Boolean = false, valueColor: Color = CarColors.NavyInk) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = CarColors.TextSecondary, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        Text(value, color = valueColor, style = if (strong) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium, fontWeight = if (strong) FontWeight.ExtraBold else FontWeight.SemiBold)
    }
}

@Composable
fun HairDivider(modifier: Modifier = Modifier) = Box(modifier.fillMaxWidth().padding(vertical = 6.dp).height(1.dp).background(Hairline))

/* --------------------------------------------------------------------------------------- rows */

/** List row: glyph or avatar, title, subtitle and an optional trailing slot (chevron by default). */
@Composable
fun CarRow(
    title: String,
    subtitle: String? = null,
    icon: ImageVector? = null,
    avatar: String? = null,
    onClick: (() -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(vertical = 8.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when {
            avatar != null -> Avatar(avatar)
            icon != null -> Glyph(icon)
        }
        if (avatar != null || icon != null) Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = CarColors.TextSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        when {
            trailing != null -> trailing()
            onClick != null -> Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, tint = CarColors.Outline, modifier = Modifier.size(20.dp))
        }
    }
}

@Composable
fun ToggleRow(title: String, subtitle: String? = null, icon: ImageVector? = null, initial: Boolean = true) {
    var on by remember { mutableStateOf(initial) }
    CarRow(title, subtitle, icon = icon, onClick = { on = !on }) {
        Switch(
            checked = on, onCheckedChange = { on = it },
            colors = SwitchDefaults.colors(checkedTrackColor = CarColors.Teal, checkedThumbColor = Color.White, uncheckedTrackColor = CarColors.Divider, uncheckedBorderColor = Color.Transparent, uncheckedThumbColor = Color.White),
        )
    }
}

/* ------------------------------------------------------------------------------------ buttons */

@Composable
fun CarButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: ImageVector? = null, tone: Color = CarColors.Navy, enabled: Boolean = true) {
    val bg by animateColorAsState(if (enabled) tone else tone.copy(alpha = 0.35f), label = "btn")
    Row(
        modifier.fillMaxWidth().height(56.dp)
            .shadow(if (enabled) 14.dp else 0.dp, RoundedCornerShape(18.dp), spotColor = tone.copy(alpha = 0.5f))
            .clip(RoundedCornerShape(18.dp)).background(bg).clickable(enabled = enabled, onClick = onClick),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) { Icon(icon, null, tint = if (tone == CarColors.Amber) CarColors.Navy else Color.White, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(10.dp)) }
        Text(text, color = if (tone == CarColors.Amber) CarColors.Navy else Color.White, style = MaterialTheme.typography.titleMedium)
    }
}

@Composable
fun GhostButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: ImageVector? = null, color: Color = CarColors.Navy) {
    Row(
        modifier.height(52.dp).clip(RoundedCornerShape(18.dp)).border(1.dp, color.copy(alpha = 0.18f), RoundedCornerShape(18.dp)).clickable(onClick = onClick).padding(horizontal = 18.dp),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) { Icon(icon, null, tint = color, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)) }
        Text(text, color = color, style = MaterialTheme.typography.titleMedium.copy(fontSize = 15.sp))
    }
}

/** Bottom action area that floats over content (checkout totals, wizard buttons). */
@Composable
fun FloatingActionBar(modifier: Modifier = Modifier, dark: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.fillMaxWidth().drawBehind {
            val base = if (dark) Color(0xFF071A30) else CarColors.Background
            drawRect(Brush.verticalGradient(listOf(Color.Transparent, base.copy(alpha = 0.96f), base), startY = 0f, endY = size.height * 0.35f))
        }.padding(start = 16.dp, end = 16.dp, top = 28.dp, bottom = 22.dp).navigationBarsPadding(),
        verticalArrangement = Arrangement.spacedBy(10.dp), content = content,
    )
}

/* ------------------------------------------------------------------------------------- inputs */

/** Soft text field: label above, pill surface, focus ring in teal. */
@Composable
fun SoftField(label: String, value: String, onValueChange: (String) -> Unit, modifier: Modifier = Modifier, icon: ImageVector? = null, placeholder: String = "", singleLine: Boolean = true, isPassword: Boolean = false, keyboardType: KeyboardType = KeyboardType.Text) {
    var focused by remember { mutableStateOf(false) }
    val ring by animateColorAsState(if (focused) CarColors.Teal.copy(alpha = 0.6f) else Hairline, label = "field")
    Column(modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = CarColors.TextTertiary, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
        Row(
            Modifier.fillMaxWidth().heightIn(min = 54.dp).clip(RoundedCornerShape(18.dp)).background(Color.White).border(1.dp, ring, RoundedCornerShape(18.dp)).padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = if (singleLine) Alignment.CenterVertically else Alignment.Top,
        ) {
            if (icon != null) { Icon(icon, null, tint = if (focused) CarColors.Teal else CarColors.Outline, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(10.dp)) }
            Box(Modifier.weight(1f)) {
                if (value.isEmpty()) Text(placeholder, color = CarColors.Outline, style = MaterialTheme.typography.bodyLarge)
                BasicTextField(
                    value = value, onValueChange = onValueChange, singleLine = singleLine,
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = CarColors.NavyInk),
                    cursorBrush = SolidColor(CarColors.Teal),
                    visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
                    keyboardOptions = KeyboardOptions(keyboardType = if (isPassword) KeyboardType.Password else keyboardType),
                    modifier = Modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused },
                )
            }
        }
    }
}

/**
 * Creative dropdown: the field morphs open into an inline glass panel (spring), options stagger in,
 * the selected one carries a teal wash + check. No popup window, so it never fights the keyboard.
 */
@Composable
fun <T> CarDropdown(label: String, options: List<T>, selected: T?, onSelect: (T) -> Unit, display: @Composable (T) -> String, modifier: Modifier = Modifier, icon: ImageVector? = null, hint: (@Composable (T) -> String)? = null) {
    var open by remember { mutableStateOf(false) }
    val rotation by animateFloatAsState(if (open) 180f else 0f, spring(dampingRatio = 0.6f, stiffness = Spring.StiffnessMediumLow), label = "chev")
    val corner by animateDpAsState(if (open) 24.dp else 18.dp, label = "corner")
    val ring by animateColorAsState(if (open) CarColors.Teal.copy(alpha = 0.55f) else Hairline, label = "ring")
    Column(modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = CarColors.TextTertiary, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
        Column(
            Modifier.fillMaxWidth()
                .shadow(if (open) 20.dp else 0.dp, RoundedCornerShape(corner), spotColor = CarColors.Navy.copy(alpha = 0.18f))
                .clip(RoundedCornerShape(corner)).background(Color.White).border(1.dp, ring, RoundedCornerShape(corner)),
        ) {
            Row(Modifier.fillMaxWidth().height(54.dp).clickable { open = !open }.padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                if (icon != null) { Icon(icon, null, tint = if (open) CarColors.Teal else CarColors.Outline, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(10.dp)) }
                Text(if (selected != null) display(selected) else "—", style = MaterialTheme.typography.bodyLarge, color = if (selected == null) CarColors.Outline else CarColors.NavyInk, modifier = Modifier.weight(1f))
                Icon(Icons.Outlined.KeyboardArrowDown, null, tint = CarColors.TextSecondary, modifier = Modifier.rotate(rotation))
            }
            AnimatedVisibility(visible = open, enter = expandVertically(spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessMediumLow)) + fadeIn(), exit = shrinkVertically() + fadeOut()) {
                Column(Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, bottom = 8.dp)) {
                    HairDivider(Modifier.padding(horizontal = 8.dp))
                    options.forEach { option ->
                        val isSelected = option == selected
                        val wash by animateColorAsState(if (isSelected) CarColors.Teal.copy(alpha = 0.08f) else Color.Transparent, label = "wash")
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(wash).clickable { onSelect(option); open = false }.padding(horizontal = 12.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(display(option), style = MaterialTheme.typography.bodyLarge, color = if (isSelected) CarColors.Teal else CarColors.NavyInk, fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal)
                                if (hint != null) Text(hint(option), style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary)
                            }
                            AnimatedVisibility(isSelected) { Icon(Icons.Outlined.Check, null, tint = CarColors.Teal, modifier = Modifier.size(18.dp)) }
                        }
                    }
                }
            }
        }
    }
}

/** Animated pill filter row (website hover-pill feel). */
@Composable
fun PillTabs(options: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    LazyRow(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(options.size) { i ->
            val active = i == selected
            val bg by animateColorAsState(if (active) CarColors.Navy else Color.White.copy(alpha = 0.7f), label = "pill")
            val fg by animateColorAsState(if (active) Color.White else CarColors.TextTertiary, label = "pillText")
            Text(
                options[i], color = fg, style = MaterialTheme.typography.labelMedium.copy(fontSize = 13.sp),
                modifier = Modifier.clip(CircleShape).background(bg).border(1.dp, if (active) Color.Transparent else Hairline, CircleShape).clickable { onSelect(i) }.padding(horizontal = 16.dp, vertical = 10.dp),
            )
        }
    }
}

/** Segmented control with a sliding thumb. */
@Composable
fun SegmentedTabs(options: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().clip(CircleShape).background(CarColors.Navy.copy(alpha = 0.05f)).padding(4.dp)) {
        options.forEachIndexed { i, text ->
            val active = i == selected
            val bg by animateColorAsState(if (active) Color.White else Color.Transparent, label = "seg")
            Box(
                Modifier.weight(1f).height(40.dp).shadow(if (active) 6.dp else 0.dp, CircleShape, spotColor = CarColors.Navy.copy(alpha = 0.2f)).clip(CircleShape).background(bg).clickable { onSelect(i) },
                contentAlignment = Alignment.Center,
            ) { Text(text, style = MaterialTheme.typography.labelMedium.copy(fontSize = 13.sp), color = if (active) CarColors.Navy else CarColors.TextSecondary, maxLines = 1) }
        }
    }
}

/* ------------------------------------------------------------------------------------- stats */

@Composable
fun StatTile(value: String, label: String, icon: ImageVector, modifier: Modifier = Modifier, accent: Color = CarColors.Teal, delta: String? = null) {
    GlassCard(modifier, padding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Glyph(icon, size = 36.dp, tint = accent)
            Spacer(Modifier.weight(1f))
            if (delta != null) Text(delta, style = MaterialTheme.typography.labelMedium, color = if (delta.startsWith("-")) CarColors.Orange else CarColors.Teal)
        }
        Spacer(Modifier.height(12.dp))
        Text(value, style = MaterialTheme.typography.headlineSmall.copy(fontSize = 24.sp), color = CarColors.Navy)
        Text(label, style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/* -------------------------------------------------------------------------------------- plate */

/** Egyptian private-car plate: light-blue band "مصر EGYPT" on top, Arabic digits | Arabic letters. */
@Composable
fun EgyptPlate(letters: String, digits: String, modifier: Modifier = Modifier, scale: Float = 1f, band: Color = Color(0xFF5BA4E6)) {
    val shape = RoundedCornerShape((10 * scale).dp)
    Column(modifier.width((210 * scale).dp).clip(shape).background(Color.White).border((2 * scale).dp, CarColors.NavyInk, shape)) {
        Row(Modifier.fillMaxWidth().height((22 * scale).dp).background(band).padding(horizontal = (10 * scale).dp), verticalAlignment = Alignment.CenterVertically) {
            Text("EGYPT", color = CarColors.NavyInk, fontSize = (10 * scale).sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Text("مصر", color = CarColors.NavyInk, fontSize = (12 * scale).sp, fontWeight = FontWeight.Bold)
        }
        Row(Modifier.fillMaxWidth().height((50 * scale).dp), verticalAlignment = Alignment.CenterVertically) {
            Text(digits, textAlign = TextAlign.Center, color = CarColors.NavyInk, fontSize = (24 * scale).sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
            Box(Modifier.width((2 * scale).dp).fillMaxHeight(0.8f).background(CarColors.NavyInk))
            Text(letters, textAlign = TextAlign.Center, color = CarColors.NavyInk, fontSize = (24 * scale).sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
        }
    }
}

/* -------------------------------------------------------------------------------------- misc */

@Composable
fun Stepper(steps: Int, current: Int, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        repeat(steps) { i ->
            val color by animateColorAsState(if (i <= current) CarColors.Teal else CarColors.Navy.copy(alpha = 0.08f), label = "step")
            val w by animateFloatAsState(if (i == current) 2f else 1f, label = "stepW")
            Box(Modifier.weight(w).height(5.dp).clip(CircleShape).background(color))
        }
    }
}

@Composable
fun EmptyHint(text: String, icon: ImageVector) {
    Column(Modifier.fillMaxWidth().padding(vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Glyph(icon, size = 64.dp)
        Spacer(Modifier.height(12.dp))
        Text(text, color = CarColors.TextSecondary, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
    }
}

/** Small badge used inside rows: "+12%", "3", etc. */
@Composable
fun CountBadge(text: String, color: Color = CarColors.Orange) {
    Text(text, color = Color.White, style = MaterialTheme.typography.labelMedium, modifier = Modifier.clip(CircleShape).background(color).padding(horizontal = 8.dp, vertical = 3.dp))
}

val NumberStyle = TextStyle(fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.5).sp)

