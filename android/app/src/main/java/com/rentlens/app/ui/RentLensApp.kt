@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.rentlens.app.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rentlens.app.data.*
import java.text.NumberFormat
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

private const val WEB_URL = "https://rentlens-peach.vercel.app"

private enum class AppTab(val label: String, val icon: ImageVector) {
    Today("Today", Icons.Default.Home), Tenants("Tenants", Icons.Default.People),
    Ledger("Ledger", Icons.Default.ReceiptLong), Outbox("Outbox", Icons.Default.Message),
    Setup("Setup", Icons.Default.Settings),
}

@Composable
fun RentLensApp(darkMode: Boolean, onToggleDarkMode: () -> Unit, model: RentLensViewModel = viewModel()) {
    val state by model.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.notice) { state.notice?.let { snackbar.showSnackbar(it); model.clearNotice() } }
    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        when {
            !state.configured -> ConfigurationScreen()
            !state.signedIn -> LoginScreen(state.loading, model::signIn, model::signUp)
            else -> MainWorkspace(state, darkMode, onToggleDarkMode, model, snackbar)
        }
    }
}

@Composable private fun ConfigurationScreen() { Box(Modifier.fillMaxSize().padding(28.dp), contentAlignment = Alignment.Center) { Card(shape = RoundedCornerShape(24.dp)) { Column(Modifier.padding(26.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { BrandMark(); Text("Connect RentLens", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold); Text("The Supabase URL and publishable key must be included when this APK is built.") } } } }

@Composable
private fun LoginScreen(loading: Boolean, onLogin: (String, String) -> Unit, onSignUp: (String, String) -> Unit) {
    var email by rememberSaveable { mutableStateOf("") }; var password by rememberSaveable { mutableStateOf("") }; var createAccount by rememberSaveable { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 24.dp), verticalArrangement = Arrangement.Center) { item {
        Spacer(Modifier.height(48.dp)); BrandMark(); Spacer(Modifier.height(28.dp))
        Text(if (createAccount) "Create your landlord workspace" else "Welcome back", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
        Text("Rent records, reminders and receipts in your pocket.", color = MaterialTheme.colorScheme.onSurfaceVariant); Spacer(Modifier.height(28.dp))
        OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), label = { Text("Email") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)); Spacer(Modifier.height(12.dp))
        OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), label = { Text("Password") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)); Spacer(Modifier.height(18.dp))
        Button(onClick = { if (createAccount) onSignUp(email, password) else onLogin(email, password) }, enabled = !loading && email.isNotBlank() && password.length >= 6, modifier = Modifier.fillMaxWidth().height(52.dp)) { if (loading) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp) else Text(if (createAccount) "Create account" else "Sign in") }
        TextButton(onClick = { createAccount = !createAccount }, modifier = Modifier.fillMaxWidth()) { Text(if (createAccount) "Already registered? Sign in" else "New landlord? Create an account") }
    } }
}

@Composable
private fun MainWorkspace(state: UiState, darkMode: Boolean, onToggleDarkMode: () -> Unit, model: RentLensViewModel, snackbar: SnackbarHostState) {
    var tab by rememberSaveable { mutableStateOf(AppTab.Today) }; var paymentTenant by remember { mutableStateOf<Tenant?>(null) }; var addTenant by remember { mutableStateOf(false) }; var promiseTenant by remember { mutableStateOf<Tenant?>(null) }
    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = { TopAppBar(title = { Column { Text(state.profile.businessName, fontWeight = FontWeight.Bold); Text(tab.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } }, actions = { IconButton(onClick = model::refresh) { if (state.loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Icon(Icons.Default.Refresh, "Refresh") } }) },
        bottomBar = { NavigationBar { AppTab.entries.forEach { item -> NavigationBarItem(selected = tab == item, onClick = { tab = item }, icon = { Icon(item.icon, item.label) }, label = { Text(item.label, maxLines = 1) }) } } },
        floatingActionButton = { if (tab == AppTab.Today || tab == AppTab.Tenants) Button(onClick = { paymentTenant = state.tenants.firstOrNull() }) { Icon(Icons.Default.Add, null); Spacer(Modifier.width(7.dp)); Text("Payment") } },
    ) { padding -> Box(Modifier.padding(padding).fillMaxSize()) { when (tab) {
        AppTab.Today -> TodayScreen(state, { paymentTenant = it }, { promiseTenant = it }, { addTenant = true }, { tab = AppTab.Outbox })
        AppTab.Tenants -> TenantsScreen(state, { paymentTenant = it }, { promiseTenant = it }, { addTenant = true })
        AppTab.Ledger -> LedgerScreen(state, model::reversePayment)
        AppTab.Outbox -> OutboxScreen(state, model::markMessageSent)
        AppTab.Setup -> SetupScreen(state, darkMode, onToggleDarkMode, model::syncNow, model::saveSettings, model::signOut)
    } } }
    paymentTenant?.let { initial -> PaymentDialog(state, initial, { paymentTenant = null }) { tenant, amount, method, reference, date -> model.recordPayment(tenant, amount, method, reference, date); paymentTenant = null } }
    if (addTenant) AddTenantDialog({ addTenant = false }) { name, phone, property, unit, rent, dueDay -> model.addTenant(name, phone, property, unit, rent, dueDay); addTenant = false }
    promiseTenant?.let { PromiseDialog(state.tenants, it, { promiseTenant = null }) { tenantId, date, note -> model.savePromise(tenantId, date, note); promiseTenant = null } }
}

@Composable
private fun TodayScreen(state: UiState, onPayment: (Tenant) -> Unit, onPromise: (Tenant) -> Unit, onAddTenant: () -> Unit, onOutbox: () -> Unit) {
    val month = YearMonth.now().toString(); val collected = state.payments.filter { it.voidedAt == null && it.paidAt.startsWith(month) }.sumOf { it.amount }; val expected = state.charges.filter { it.chargeMonth.startsWith(month) }.sumOf { it.amount }; val outstanding = state.tenants.sumOf { it.balance }; val attention = state.tenants.filter { it.status != "paid" }.sortedBy { if (it.status == "overdue") 0 else 1 }; val pendingMessages = state.messages.count { it.status == "queued" || it.status == "failed" }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (state.pendingPayments > 0) item { SyncBanner(state.pendingPayments) }
        item { Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary)) { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) { Text("THIS MONTH'S RENT CYCLE", color = MaterialTheme.colorScheme.onPrimary.copy(alpha = .75f), style = MaterialTheme.typography.labelMedium); Text("${money(collected)} collected", color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold); Text("of ${money(expected)} expected · ${state.payments.count { it.paidAt.startsWith(month) && it.voidedAt == null }} receipts", color = MaterialTheme.colorScheme.onPrimary) } } }
        item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { MetricCard("Outstanding", money(outstanding), Icons.Default.AccountBalanceWallet, Modifier.weight(1f)); MetricCard("Overdue", state.tenants.count { it.status == "overdue" }.toString(), Icons.Default.CalendarMonth, Modifier.weight(1f)) } }
        item { Card { Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Text("Quick actions", fontWeight = FontWeight.Bold); Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) { TextButton(onClick = onAddTenant) { Text("Add tenant") }; TextButton(onClick = { state.tenants.firstOrNull()?.let(onPromise) }) { Text("Promise") }; TextButton(onClick = onOutbox) { Text("Outbox ($pendingMessages)") } } } } }
        item { Text("Needs attention", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
        items(attention.take(8), key = { it.id }) { TenantCard(it, onPayment, onPromise, state) }
        if (state.tenants.isEmpty()) item { EmptyCard("No tenants yet", "Add your first tenant and unit from this app.") }
        item { Spacer(Modifier.height(80.dp)) }
    }
}

@Composable
private fun TenantsScreen(state: UiState, onPayment: (Tenant) -> Unit, onPromise: (Tenant) -> Unit, onAddTenant: () -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }; var filter by rememberSaveable { mutableStateOf("all") }
    val filtered = state.tenants.filter { (query.isBlank() || "${it.fullName} ${it.unitName} ${it.phone}".contains(query, true)) && (filter == "all" || it.status == filter) }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Row(verticalAlignment = Alignment.CenterVertically) { Text("Tenants & units", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f)); Button(onClick = onAddTenant) { Icon(Icons.Default.Add, null); Text(" Add") } } }
        item { OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), leadingIcon = { Icon(Icons.Default.Search, null) }, placeholder = { Text("Search tenant, unit or phone") }, singleLine = true) }
        item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("all", "overdue", "promised").forEach { value -> FilterChip(selected = filter == value, onClick = { filter = value }, label = { Text(value.replaceFirstChar { it.uppercase() }) }) } } }
        items(filtered, key = { it.id }) { TenantCard(it, onPayment, onPromise, state) }; item { Spacer(Modifier.height(80.dp)) }
    }
}

@Composable
private fun TenantCard(tenant: Tenant, onPayment: (Tenant) -> Unit, onPromise: (Tenant) -> Unit, state: UiState) {
    var details by remember { mutableStateOf(false) }; val context = LocalContext.current
    Card(onClick = { details = true }, modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) { Avatar(tenant.fullName); Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) { Text(tenant.fullName, fontWeight = FontWeight.Bold); Text("${tenant.unitName} · ${tenant.phone}", color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis) }; StatusPill(tenant.status) }
        Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text(money(tenant.balance), fontWeight = FontWeight.ExtraBold); Text("outstanding", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }; IconButton(onClick = { openWhatsApp(context, tenant.phone, reminderMessage(tenant)) }, enabled = tenant.whatsappOptIn) { Icon(Icons.Default.Message, "Remind") }; TextButton(onClick = { onPayment(tenant) }) { Text("Pay") } }
    } }
    if (details) TenantDetailDialog(state, tenant, { details = false }, { details = false; onPayment(tenant) }, { details = false; onPromise(tenant) })
}

@Composable
private fun LedgerScreen(state: UiState, onReverse: (String, String) -> Unit) {
    val context = LocalContext.current; var selected by remember { mutableStateOf<Payment?>(null) }; val names = state.tenants.associate { it.id to it.fullName }; val active = state.payments.filter { it.voidedAt == null }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text("Receipts & rent ledger", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold); Text("Corrections are reversed, never deleted.", color = MaterialTheme.colorScheme.onSurfaceVariant) }; OutlinedButton(onClick = { shareLedger(context, state.payments, names) }) { Icon(Icons.Default.Share, null); Text(" CSV") } } }
        item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { MetricCard("Active receipts", active.size.toString(), Icons.Default.ReceiptLong, Modifier.weight(1f)); MetricCard("Active total", money(active.sumOf { it.amount }), Icons.Default.AccountBalanceWallet, Modifier.weight(1f)) } }
        items(state.payments, key = { it.id }) { payment -> ReceiptCard(payment, names[payment.tenantId] ?: payment.tenantNameSnapshot ?: "Tenant") { selected = payment } }
        if (state.payments.isEmpty()) item { EmptyCard("No receipts yet", "Confirmed payments will appear here permanently.") }; item { Spacer(Modifier.height(80.dp)) }
    }
    selected?.let { payment -> ReceiptDialog(payment, names[payment.tenantId] ?: payment.tenantNameSnapshot ?: "Tenant", state.profile.businessName, { selected = null }, { reason -> onReverse(payment.id, reason); selected = null }) }
}

@Composable
private fun OutboxScreen(state: UiState, onSent: (String) -> Unit) {
    val context = LocalContext.current; val names = state.tenants.associateBy { it.id }; val pending = state.messages.filter { it.status == "queued" || it.status == "failed" }; var queue by remember { mutableStateOf<List<MessageRow>>(emptyList()) }; var index by remember { mutableStateOf<Int?>(null) }; var opened by remember { mutableStateOf(false) }; val current = index?.let { queue.getOrNull(it) }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text("WhatsApp outbox", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold); Text("Review prepared messages from one guided queue.", color = MaterialTheme.colorScheme.onSurfaceVariant) }; Button(onClick = { queue = pending; index = 0; opened = false }, enabled = pending.isNotEmpty()) { Icon(Icons.Default.Send, null); Text(" All (${pending.size})") } } }
        items(state.messages, key = { it.id }) { message -> val tenant = names[message.tenantId]; Card { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { Row { Text(tenant?.fullName ?: "Tenant", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f)); StatusPill(message.status) }; Text(message.body, maxLines = 3, overflow = TextOverflow.Ellipsis); Text(message.type.replace('_', ' ').replaceFirstChar { it.uppercase() }, color = MaterialTheme.colorScheme.onSurfaceVariant); message.failureReason?.let { Text(it, color = MaterialTheme.colorScheme.error) }; OutlinedButton(onClick = { if (tenant != null) openWhatsApp(context, tenant.phone, message.body) }, enabled = tenant != null) { Icon(Icons.Default.Message, null); Text(" Review in WhatsApp") } } } }
        if (state.messages.isEmpty()) item { EmptyCard("Outbox is clear", "Reminder and receipt messages will appear here when prepared.") }; item { Spacer(Modifier.height(80.dp)) }
    }
    if (index != null) { if (current == null) AlertDialog(onDismissRequest = { index = null }, title = { Text("Outbox reviewed") }, text = { Text("All ${queue.size} messages were reviewed. Skipped messages remain available.") }, confirmButton = { Button(onClick = { index = null }) { Text("Done") } }) else { val tenant = names[current.tenantId]; AlertDialog(onDismissRequest = { index = null }, title = { Text("Message ${(index ?: 0) + 1} of ${queue.size}") }, text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { Text(tenant?.fullName ?: "Tenant", fontWeight = FontWeight.Bold); Text(current.body); Text(if (opened) "After sending in WhatsApp, confirm below." else "Open WhatsApp to review and send.", color = MaterialTheme.colorScheme.onSurfaceVariant) } }, confirmButton = { Button(onClick = { if (!opened) { if (tenant != null) openWhatsApp(context, tenant.phone, current.body); opened = true } else { onSent(current.id); index = (index ?: 0) + 1; opened = false } }, enabled = tenant != null) { Text(if (opened) "Sent — next" else "Open WhatsApp") } }, dismissButton = { TextButton(onClick = { index = (index ?: 0) + 1; opened = false }) { Text("Skip") } }) } }
}

@Composable
private fun SetupScreen(state: UiState, darkMode: Boolean, onToggleDarkMode: () -> Unit, onSync: () -> Unit, onSave: (Profile, LandlordSettings) -> Unit, onSignOut: () -> Unit) {
    var business by remember(state.profile) { mutableStateOf(state.profile.businessName) }; var fullName by remember(state.profile) { mutableStateOf(state.profile.fullName) }; var remindDays by remember(state.settings) { mutableStateOf(state.settings.remindDaysBefore.toString()) }; var repeatDays by remember(state.settings) { mutableStateOf(state.settings.overdueRepeatDays.toString()) }; var holidays by remember(state.settings) { mutableStateOf(state.settings.holidayMessagesEnabled) }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Business & reminders", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold) }
        item { OutlinedTextField(business, { business = it }, Modifier.fillMaxWidth(), label = { Text("Business name") }) }; item { OutlinedTextField(fullName, { fullName = it }, Modifier.fillMaxWidth(), label = { Text("Your name") }) }
        item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { OutlinedTextField(remindDays, { remindDays = it.filter(Char::isDigit) }, Modifier.weight(1f), label = { Text("Remind before") }, suffix = { Text("days") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)); OutlinedTextField(repeatDays, { repeatDays = it.filter(Char::isDigit) }, Modifier.weight(1f), label = { Text("Repeat every") }, suffix = { Text("days") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)) } }
        item { Card { Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text("Prepare holiday greetings", fontWeight = FontWeight.Bold); Text("For opted-in tenants", color = MaterialTheme.colorScheme.onSurfaceVariant) }; Switch(checked = holidays, onCheckedChange = { holidays = it }) } } }
        item { Button(onClick = { onSave(Profile(fullName, business), LandlordSettings(remindDaysBefore = remindDays.toIntOrNull()?.coerceIn(0, 30) ?: 3, overdueRepeatDays = repeatDays.toIntOrNull()?.coerceIn(1, 30) ?: 7, holidayMessagesEnabled = holidays)) }, Modifier.fillMaxWidth()) { Text("Save settings") } }
        item { Card { Column { SettingRow(if (darkMode) Icons.Default.LightMode else Icons.Default.DarkMode, if (darkMode) "Use light mode" else "Use dark mode", onToggleDarkMode); HorizontalDivider(); SettingRow(Icons.Default.Sync, "Sync ${state.pendingPayments} pending payments", onSync) } } }
        item { OutlinedButton(onClick = onSignOut, Modifier.fillMaxWidth()) { Icon(Icons.Default.Logout, null); Spacer(Modifier.width(8.dp)); Text("Sign out") } }; item { Text("Database connected · Monthly charges automatic · Offline payments auto-sync · Receipts retained", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }; item { Spacer(Modifier.height(70.dp)) }
    }
}

@Composable
private fun AddTenantDialog(onDismiss: () -> Unit, onSave: (String, String, String, String, Double, Int) -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }; var phone by rememberSaveable { mutableStateOf("+256 ") }; var property by rememberSaveable { mutableStateOf("") }; var unit by rememberSaveable { mutableStateOf("") }; var rent by rememberSaveable { mutableStateOf("") }; var dueDay by rememberSaveable { mutableStateOf("5") }; var consent by rememberSaveable { mutableStateOf(false) }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Add tenant & unit") }, text = { LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), label = { Text("Tenant full name") }) }; item { OutlinedTextField(phone, { phone = it }, Modifier.fillMaxWidth(), label = { Text("WhatsApp number") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)) }; item { OutlinedTextField(property, { property = it }, Modifier.fillMaxWidth(), label = { Text("Property") }) }; item { OutlinedTextField(unit, { unit = it }, Modifier.fillMaxWidth(), label = { Text("Unit / room") }) }; item { OutlinedTextField(rent, { rent = it.filter(Char::isDigit) }, Modifier.fillMaxWidth(), label = { Text("Monthly rent (UGX)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)) }; item { OutlinedTextField(dueDay, { dueDay = it.filter(Char::isDigit) }, Modifier.fillMaxWidth(), label = { Text("Rent due day (1–28)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)) }; item { Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(consent, { consent = it }); Text("Tenant agreed to WhatsApp messages") } }
    } }, confirmButton = { Button(onClick = { onSave(name, phone, property, unit, rent.toDoubleOrNull() ?: 0.0, dueDay.toIntOrNull() ?: 0) }, enabled = consent && name.isNotBlank() && property.isNotBlank() && unit.isNotBlank() && (rent.toDoubleOrNull() ?: 0.0) > 0 && (dueDay.toIntOrNull() ?: 0) in 1..28) { Text("Add tenant") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } })
}

@Composable
private fun PromiseDialog(tenants: List<Tenant>, initial: Tenant, onDismiss: () -> Unit, onSave: (String, String, String) -> Unit) {
    var tenant by remember { mutableStateOf(initial) }; var expanded by remember { mutableStateOf(false) }; var date by rememberSaveable { mutableStateOf(LocalDate.now().plusDays(1).toString()) }; var note by rememberSaveable { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Record payment promise") }, text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { ExposedDropdownMenuBox(expanded, { expanded = it }) { OutlinedTextField(tenant.fullName, {}, Modifier.menuAnchor().fillMaxWidth(), readOnly = true, label = { Text("Tenant") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) }); ExposedDropdownMenu(expanded, { expanded = false }) { tenants.forEach { option -> DropdownMenuItem(text = { Text("${option.fullName} — ${money(option.balance)} due") }, onClick = { tenant = option; expanded = false }) } } }; OutlinedTextField(date, { date = it }, Modifier.fillMaxWidth(), label = { Text("Promised date (YYYY-MM-DD)") }); OutlinedTextField(note, { note = it }, Modifier.fillMaxWidth(), label = { Text("What did the tenant say?") }, minLines = 3) } }, confirmButton = { Button(onClick = { onSave(tenant.id, date, note) }, enabled = runCatching { LocalDate.parse(date) }.isSuccess) { Text("Save promise") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } })
}

@Composable
private fun PaymentDialog(state: UiState, initial: Tenant, onDismiss: () -> Unit, onSave: (Tenant, Double, String, String?, String) -> Unit) {
    var tenant by remember { mutableStateOf(initial) }; var expanded by remember { mutableStateOf(false) }; var amount by rememberSaveable { mutableStateOf("") }; var method by rememberSaveable { mutableStateOf("Mobile Money") }; var reference by rememberSaveable { mutableStateOf("") }; var date by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }; val number = amount.toDoubleOrNull() ?: 0.0; val duplicate = state.payments.any { it.tenantId == tenant.id && it.amount == number && it.paidAt.startsWith(date) && it.voidedAt == null }; val allocations = allocate(state.charges.filter { it.tenantId == tenant.id }, number)
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Confirm a rent payment") }, text = { LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        item { ExposedDropdownMenuBox(expanded, { expanded = it }) { OutlinedTextField(tenant.fullName, {}, Modifier.menuAnchor().fillMaxWidth(), readOnly = true, label = { Text("Tenant") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) }); ExposedDropdownMenu(expanded, { expanded = false }) { state.tenants.forEach { option -> DropdownMenuItem(text = { Text("${option.fullName} · ${option.unitName}") }, onClick = { tenant = option; amount = ""; expanded = false }) } } } }; item { Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) { Row(Modifier.fillMaxWidth().padding(13.dp)) { Text("Outstanding", Modifier.weight(1f)); Text(money(tenant.balance), fontWeight = FontWeight.Bold) } } }; item { OutlinedTextField(amount, { amount = it.filter(Char::isDigit) }, Modifier.fillMaxWidth(), label = { Text("Amount received (UGX)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)) }; item { OutlinedTextField(date, { date = it }, Modifier.fillMaxWidth(), label = { Text("Payment date (YYYY-MM-DD)") }) }; item { Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) { listOf("Mobile Money", "Cash", "Bank").forEach { value -> FilterChip(selected = method == value, onClick = { method = value }, label = { Text(value) }) } } }; item { OutlinedTextField(reference, { reference = it }, Modifier.fillMaxWidth(), label = { Text("Transaction reference (optional)") }) }
        if (number > 0) item { Card { Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) { Text("Payment allocation", fontWeight = FontWeight.Bold); allocations.forEach { Row { Text(it.first, Modifier.weight(1f)); Text(money(it.second)) } }; HorizontalDivider(); Row { Text("Balance after", Modifier.weight(1f)); Text(money((tenant.balance - number).coerceAtLeast(0.0)), fontWeight = FontWeight.Bold) } } } }; if (duplicate) item { Text("Possible duplicate: the same payment already exists for this tenant and date.", color = MaterialTheme.colorScheme.error) }; item { Text("If offline, this payment is retained and syncs after reconnection.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    } }, confirmButton = { Button(onClick = { onSave(tenant, number, method, reference, date) }, enabled = number > 0 && number <= tenant.balance && runCatching { LocalDate.parse(date) }.isSuccess && !duplicate) { Text("Confirm & receipt") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } })
}

@Composable
private fun TenantDetailDialog(state: UiState, tenant: Tenant, onDismiss: () -> Unit, onPayment: () -> Unit, onPromise: () -> Unit) {
    val history = buildList { state.payments.filter { it.tenantId == tenant.id }.forEach { add(HistoryLine(it.paidAt, "${money(it.amount)} payment${if (it.voidedAt != null) " (reversed)" else ""}", it.receiptNumber)) }; state.charges.filter { it.tenantId == tenant.id }.forEach { add(HistoryLine(it.dueDate, "${monthLabel(it.chargeMonth)} rent", "${money(it.paidAmount)} of ${money(it.amount)} paid")) }; state.messages.filter { it.tenantId == tenant.id }.forEach { add(HistoryLine(it.createdAt, "${it.type.replace('_', ' ')} message", it.status)) } }.sortedByDescending { it.date }
    AlertDialog(onDismissRequest = onDismiss, title = { Text(tenant.fullName) }, text = { LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) { item { Text("${tenant.unitName} · ${tenant.phone}", color = MaterialTheme.colorScheme.onSurfaceVariant); Text("${money(tenant.balance)} outstanding", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold) }; item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { TextButton(onClick = onPayment) { Text("Record payment") }; TextButton(onClick = onPromise) { Text("Add promise") } } }; item { HorizontalDivider(); Text("Receipts & account history", fontWeight = FontWeight.Bold) }; items(history) { line -> Column { Text(line.title, fontWeight = FontWeight.Medium); Text("${dateLabel(line.date)} · ${line.detail}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) } }; if (history.isEmpty()) item { Text("No history yet.") } } }, confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } })
}

@Composable
private fun ReceiptDialog(payment: Payment, tenantName: String, businessName: String, onDismiss: () -> Unit, onReverse: (String) -> Unit) {
    val context = LocalContext.current; var reversing by remember { mutableStateOf(false) }; var reason by remember { mutableStateOf("") }; val text = receiptText(payment, tenantName, businessName)
    AlertDialog(onDismissRequest = onDismiss, title = { Text(payment.receiptNumber) }, text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { Text(businessName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold); Text("RENT RECEIPT", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold); HorizontalDivider(); Text("Tenant: $tenantName"); Text("Date: ${dateLabel(payment.paidAt)}"); Text("Method: ${payment.paymentMethod}"); payment.reference?.let { Text("Reference: $it") }; Text("Total paid: ${money(payment.amount)}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold); payment.balanceAfter?.let { Text("Balance remaining: ${money(it)}") }; if (payment.voidedAt != null) Text("REVERSED · ${payment.voidReason.orEmpty()}", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold); if (reversing) OutlinedTextField(reason, { reason = it }, Modifier.fillMaxWidth(), label = { Text("Reversal reason") }) } }, confirmButton = { Row { IconButton(onClick = { shareText(context, "Rent receipt ${payment.receiptNumber}", text) }) { Icon(Icons.Default.Share, "Share") }; IconButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("$WEB_URL/receipt/${payment.id}"))) }) { Icon(Icons.Default.ReceiptLong, "Open receipt") }; if (reversing) Button(onClick = { onReverse(reason) }, enabled = reason.trim().length >= 3) { Text("Confirm") } else if (payment.voidedAt == null) TextButton(onClick = { reversing = true }) { Text("Reverse", color = MaterialTheme.colorScheme.error) } } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Close") } })
}

@Composable private fun ReceiptCard(payment: Payment, tenantName: String, onOpen: () -> Unit) { Card(onClick = onOpen, colors = CardDefaults.cardColors(containerColor = if (payment.voidedAt == null) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.errorContainer)) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) { Row { Text(payment.receiptNumber, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f)); Text(if (payment.voidedAt == null) "Confirmed" else "Reversed", fontWeight = FontWeight.Bold, color = if (payment.voidedAt == null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error) }; Text(tenantName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold); Text("${dateLabel(payment.paidAt)} · ${payment.paymentMethod}", color = MaterialTheme.colorScheme.onSurfaceVariant); Text(money(payment.amount), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold) } } }
@Composable private fun MetricCard(label: String, value: String, icon: ImageVector, modifier: Modifier = Modifier) { Card(modifier) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Icon(icon, null, tint = MaterialTheme.colorScheme.primary); Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant); Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold) } } }
@Composable private fun SyncBanner(count: Int) { Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) { Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.Sync, null); Spacer(Modifier.width(10.dp)); Text("$count payment${if (count == 1) "" else "s"} waiting to sync", fontWeight = FontWeight.Bold) } } }
@Composable private fun EmptyCard(title: String, message: String) { Card { Column(Modifier.padding(22.dp)) { Text(title, fontWeight = FontWeight.Bold); Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant) } } }
@Composable private fun Avatar(name: String) { Box(Modifier.size(42.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape), contentAlignment = Alignment.Center) { Text(name.split(" ").take(2).mapNotNull { it.firstOrNull()?.toString() }.joinToString(""), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.ExtraBold) } }
@Composable private fun StatusPill(status: String) { val color = when (status) { "paid", "sent", "delivered", "read" -> MaterialTheme.colorScheme.primary; "overdue", "failed" -> MaterialTheme.colorScheme.error; else -> MaterialTheme.colorScheme.tertiary }; Text(status.replaceFirstChar { it.uppercase() }, color = color, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold) }
@Composable private fun BrandMark() { Row(verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(50.dp).background(MaterialTheme.colorScheme.primary, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) { Icon(Icons.Default.Apartment, null, tint = Color.White) }; Spacer(Modifier.width(12.dp)); Column { Text("RentLens", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold); Text("RENT COLLECTION MADE CLEAR", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } } }
@Composable private fun SettingRow(icon: ImageVector, label: String, action: () -> Unit) { Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) { Icon(icon, null); Spacer(Modifier.width(12.dp)); Text(label, Modifier.weight(1f), fontWeight = FontWeight.Medium); TextButton(onClick = action) { Text("Open") } } }

private data class HistoryLine(val date: String, val title: String, val detail: String)
private fun money(value: Double): String = "UGX ${NumberFormat.getIntegerInstance(Locale.US).format(value)}"
private fun dateLabel(value: String): String = runCatching { LocalDate.parse(value.take(10)).format(DateTimeFormatter.ofPattern("d MMM yyyy")) }.getOrDefault(value.take(10))
private fun monthLabel(value: String): String = runCatching { LocalDate.parse(value.take(10)).format(DateTimeFormatter.ofPattern("MMMM yyyy")) }.getOrDefault(value.take(7))
private fun reminderMessage(tenant: Tenant) = "Hello ${tenant.fullName}, this is a friendly reminder that your rent balance is ${money(tenant.balance)}. Thank you."
private fun openWhatsApp(context: Context, phone: String, message: String) { val digits = phone.filter(Char::isDigit).let { if (it.startsWith("0")) "256${it.drop(1)}" else it }; context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$digits?text=${Uri.encode(message)}"))) }
private fun shareText(context: Context, title: String, text: String) { context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_SUBJECT, title); putExtra(Intent.EXTRA_TEXT, text) }, "Share with")) }
private fun receiptText(payment: Payment, tenant: String, business: String) = "$business\nRENT RECEIPT ${payment.receiptNumber}\nTenant: $tenant\nDate: ${dateLabel(payment.paidAt)}\nAmount: ${money(payment.amount)}\nMethod: ${payment.paymentMethod}\nBalance remaining: ${money(payment.balanceAfter ?: 0.0)}\nThank you for your payment."
private fun shareLedger(context: Context, payments: List<Payment>, names: Map<String, String>) { val csv = buildString { appendLine("Receipt,Tenant,Date,Method,Reference,Amount,Status"); payments.forEach { appendLine(listOf(it.receiptNumber, names[it.tenantId].orEmpty(), it.paidAt.take(10), it.paymentMethod, it.reference.orEmpty(), it.amount.toString(), if (it.voidedAt == null) "Confirmed" else "Reversed").joinToString(",") { value -> "\"${value.replace("\"", "\"\"")}\"" }) } }; shareText(context, "RentLens rent ledger", csv) }
private fun allocate(charges: List<Charge>, amount: Double): List<Pair<String, Double>> { var remaining = amount; return charges.filter { it.status == "due" || it.status == "partial" }.sortedBy { it.dueDate }.mapNotNull { charge -> if (remaining <= 0) null else { val allocated = minOf(remaining, charge.amount - charge.paidAmount); remaining -= allocated; monthLabel(charge.chargeMonth) to allocated } } }
