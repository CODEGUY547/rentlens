@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.rentlens.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Apartment
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.WhatsApp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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
import com.rentlens.app.data.Payment
import com.rentlens.app.data.Tenant
import java.text.NumberFormat
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

private enum class AppTab(val label: String, val icon: ImageVector) {
    Today("Today", Icons.Default.Home), Tenants("Tenants", Icons.Default.People),
    Receipts("Receipts", Icons.Default.ReceiptLong), Setup("Setup", Icons.Default.Settings),
}

@Composable
fun RentLensApp(darkMode: Boolean, onToggleDarkMode: () -> Unit, model: RentLensViewModel = viewModel()) {
    val state by model.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.notice) {
        state.notice?.let { snackbar.showSnackbar(it); model.clearNotice() }
    }
    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        when {
            !state.configured -> ConfigurationScreen()
            !state.signedIn -> LoginScreen(state.loading, model::signIn, model::signUp)
            else -> MainWorkspace(state, state.loading, darkMode, onToggleDarkMode, model, snackbar)
        }
    }
}

@Composable
private fun ConfigurationScreen() {
    Box(Modifier.fillMaxSize().padding(28.dp), contentAlignment = Alignment.Center) {
        Card(shape = RoundedCornerShape(24.dp)) {
            Column(Modifier.padding(26.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                BrandMark()
                Text("Connect RentLens", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Add SUPABASE_PUBLISHABLE_KEY to local.properties, then rebuild the APK. The project URL is already configured.")
            }
        }
    }
}

@Composable
private fun LoginScreen(loading: Boolean, onLogin: (String, String) -> Unit, onSignUp: (String, String) -> Unit) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var createAccount by rememberSaveable { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 24.dp), verticalArrangement = Arrangement.Center) {
        item {
            Spacer(Modifier.height(48.dp)); BrandMark(); Spacer(Modifier.height(28.dp))
            Text(if (createAccount) "Create your landlord workspace" else "Welcome back", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
            Text("Rent records, reminders and receipts in your pocket.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(28.dp))
            OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), label = { Text("Email") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), label = { Text("Password") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
            Spacer(Modifier.height(18.dp))
            Button(onClick = { if (createAccount) onSignUp(email, password) else onLogin(email, password) }, enabled = !loading && email.isNotBlank() && password.length >= 6, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                if (loading) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp) else Text(if (createAccount) "Create account" else "Sign in")
            }
            TextButton(onClick = { createAccount = !createAccount }, Modifier.fillMaxWidth()) { Text(if (createAccount) "Already registered? Sign in" else "New landlord? Create an account") }
            Spacer(Modifier.height(48.dp))
        }
    }
}

@Composable
private fun MainWorkspace(state: UiState, loading: Boolean, darkMode: Boolean, onToggleDarkMode: () -> Unit, model: RentLensViewModel, snackbar: SnackbarHostState) {
    var tab by rememberSaveable { mutableStateOf(AppTab.Today) }
    var paymentTenant by remember { mutableStateOf<Tenant?>(null) }
    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = { TopAppBar(title = { Column { Text(state.profile.businessName, fontWeight = FontWeight.Bold); Text(tab.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } }, actions = { IconButton(onClick = model::refresh) { if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Icon(Icons.Default.Refresh, "Refresh") } }) },
        bottomBar = { NavigationBar { AppTab.entries.forEach { item -> NavigationBarItem(selected = tab == item, onClick = { tab = item }, icon = { Icon(item.icon, item.label) }, label = { Text(item.label) }) } } },
        floatingActionButton = { if (tab == AppTab.Today || tab == AppTab.Tenants) Button(onClick = { paymentTenant = state.tenants.firstOrNull() }) { Icon(Icons.Default.Add, null); Spacer(Modifier.width(7.dp)); Text("Payment") } },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when (tab) {
                AppTab.Today -> TodayScreen(state) { paymentTenant = it }
                AppTab.Tenants -> TenantsScreen(state.tenants) { paymentTenant = it }
                AppTab.Receipts -> ReceiptsScreen(state.payments, state.tenants)
                AppTab.Setup -> SetupScreen(state, darkMode, onToggleDarkMode, model::signOut)
            }
        }
    }
    paymentTenant?.let { initial -> PaymentDialog(state.tenants, initial, onDismiss = { paymentTenant = null }) { tenant, amount, method, reference -> model.recordPayment(tenant, amount, method, reference); paymentTenant = null } }
}

@Composable
private fun TodayScreen(state: UiState, onPayment: (Tenant) -> Unit) {
    val currentMonth = YearMonth.now().toString()
    val collected = state.payments.filter { it.voidedAt == null && it.paidAt.startsWith(currentMonth) }.sumOf { it.amount }
    val outstanding = state.tenants.sumOf { it.balance }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (state.pendingPayments > 0) item { SyncBanner(state.pendingPayments) }
        item { Text("Your rentals at a glance", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold) }
        item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { MetricCard("Collected", money(collected), Icons.Default.AccountBalanceWallet, Modifier.weight(1f)); MetricCard("Outstanding", money(outstanding), Icons.Default.Apartment, Modifier.weight(1f)) } }
        item { Text("Needs attention", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
        items(state.tenants.filter { it.status in listOf("overdue", "partial", "promised", "due") }.take(8), key = { it.id }) { tenant -> TenantCard(tenant, onPayment) }
        if (state.tenants.isEmpty()) item { EmptyCard("No tenants yet", "Add your first tenant on the web dashboard. Mobile tenant creation is the next workflow to add.") }
        item { Spacer(Modifier.height(80.dp)) }
    }
}

@Composable
private fun TenantsScreen(tenants: List<Tenant>, onPayment: (Tenant) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var selected by remember { mutableStateOf<Tenant?>(null) }
    val filtered = tenants.filter { query.isBlank() || it.fullName.contains(query, true) || it.unitName.contains(query, true) }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), leadingIcon = { Icon(Icons.Default.Search, null) }, placeholder = { Text("Search name or unit") }, singleLine = true) }
        items(filtered, key = { it.id }) { tenant -> TenantCard(tenant, { onPayment(it) }, { selected = tenant }) }
        item { Spacer(Modifier.height(80.dp)) }
    }
    selected?.let { tenant -> TenantDialog(tenant, onDismiss = { selected = null }, onPayment = { selected = null; onPayment(tenant) }) }
}

@Composable
private fun ReceiptsScreen(payments: List<Payment>, tenants: List<Tenant>) {
    val names = tenants.associate { it.id to it.fullName }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Permanent receipt history", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold); Text("Reversed payments remain visible for a complete audit trail.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        items(payments, key = { it.id }) { payment -> ReceiptCard(payment, names[payment.tenantId] ?: "Tenant") }
        if (payments.isEmpty()) item { EmptyCard("No receipts yet", "Confirmed payments will appear here.") }
        item { Spacer(Modifier.height(80.dp)) }
    }
}

@Composable
private fun SetupScreen(state: UiState, darkMode: Boolean, onToggleDarkMode: () -> Unit, onSignOut: () -> Unit) {
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Card { Column(Modifier.padding(18.dp)) { Text(state.profile.businessName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold); Text(state.profile.fullName.ifBlank { "Landlord account" }, color = MaterialTheme.colorScheme.onSurfaceVariant) } } }
        item { Card { Column { SettingRow(if (darkMode) Icons.Default.LightMode else Icons.Default.DarkMode, if (darkMode) "Use light mode" else "Use dark mode", onToggleDarkMode); HorizontalDivider(); SettingRow(Icons.Default.Sync, "Sync now", {}) } } }
        item { OutlinedButton(onClick = onSignOut, Modifier.fillMaxWidth()) { Icon(Icons.Default.Logout, null); Spacer(Modifier.width(8.dp)); Text("Sign out") } }
        item { Text("RentLens Android 1.0\nUses the same secure Supabase records as the web dashboard.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun MetricCard(label: String, value: String, icon: ImageVector, modifier: Modifier = Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Icon(icon, null, tint = MaterialTheme.colorScheme.primary); Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant); Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold) } }
}

@Composable
private fun TenantCard(tenant: Tenant, onPayment: (Tenant) -> Unit, onOpen: (() -> Unit)? = null) {
    Card(onClick = { onOpen?.invoke() }, modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) { Row(verticalAlignment = Alignment.CenterVertically) { Avatar(tenant.fullName); Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) { Text(tenant.fullName, fontWeight = FontWeight.Bold); Text(tenant.unitName, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis) }; StatusPill(tenant.status) }; Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text(money(tenant.balance), fontWeight = FontWeight.ExtraBold); Text("outstanding", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }; TextButton(onClick = { onPayment(tenant) }) { Text("Record payment") } } } }
}

@Composable
private fun ReceiptCard(payment: Payment, tenantName: String) {
    Card(colors = CardDefaults.cardColors(containerColor = if (payment.voidedAt == null) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.errorContainer)) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) { Row { Text(payment.receiptNumber, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f)); Text(if (payment.voidedAt == null) "Confirmed" else "Reversed", fontWeight = FontWeight.Bold, color = if (payment.voidedAt == null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error) }; Text(tenantName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold); Text("${dateLabel(payment.paidAt)} · ${payment.paymentMethod}", color = MaterialTheme.colorScheme.onSurfaceVariant); Text(money(payment.amount), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold); payment.voidReason?.let { Text("Reason: $it", color = MaterialTheme.colorScheme.error) } } }
}

@Composable
private fun PaymentDialog(tenants: List<Tenant>, initial: Tenant, onDismiss: () -> Unit, onSave: (Tenant, Double, String, String?) -> Unit) {
    var tenant by remember { mutableStateOf(initial) }; var expanded by remember { mutableStateOf(false) }
    var amount by rememberSaveable { mutableStateOf("") }; var method by rememberSaveable { mutableStateOf("Mobile Money") }; var reference by rememberSaveable { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Record a payment") }, text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        ExposedDropdownMenuBox(expanded, { expanded = it }) { OutlinedTextField(tenant.fullName, {}, readOnly = true, label = { Text("Tenant") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) }, modifier = Modifier.menuAnchor().fillMaxWidth()); ExposedDropdownMenu(expanded, { expanded = false }) { tenants.forEach { option -> DropdownMenuItem({ Text("${option.fullName} · ${option.unitName}") }, { tenant = option; expanded = false }) } } }
        OutlinedTextField(amount, { amount = it.filter(Char::isDigit) }, Modifier.fillMaxWidth(), label = { Text("Amount received (UGX)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("Mobile Money", "Cash", "Bank transfer").forEach { item -> TextButton(onClick = { method = item }) { Text(if (method == item) "✓ $item" else item) } } }
        OutlinedTextField(reference, { reference = it }, Modifier.fillMaxWidth(), label = { Text("Reference (optional)") }, singleLine = true)
        Text("If the phone is offline, this payment is saved securely and syncs when connectivity returns.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    } }, confirmButton = { Button(onClick = { onSave(tenant, amount.toDoubleOrNull() ?: 0.0, method, reference) }, enabled = (amount.toDoubleOrNull() ?: 0.0) > 0) { Text("Confirm & create receipt") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } })
}

@Composable
private fun TenantDialog(tenant: Tenant, onDismiss: () -> Unit, onPayment: () -> Unit) {
    val context = LocalContext.current
    AlertDialog(onDismissRequest = onDismiss, title = { Text(tenant.fullName) }, text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { Text(tenant.unitName); Text("Monthly rent: ${money(tenant.monthlyRent)}"); Text("Outstanding: ${money(tenant.balance)}", fontWeight = FontWeight.Bold); Text("Due every month on day ${tenant.dueDay}"); Text("Phone: ${tenant.phone}") } }, confirmButton = { Button(onClick = onPayment) { Text("Record payment") } }, dismissButton = { Row { IconButton(onClick = { openWhatsApp(context, tenant.phone, "Hello ${tenant.fullName}, this is a reminder from RentLens regarding your rent balance of ${money(tenant.balance)}.") }) { Icon(Icons.Default.WhatsApp, "WhatsApp") }; TextButton(onClick = onDismiss) { Text("Close") } } })
}

@Composable private fun SyncBanner(count: Int) { Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) { Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.Sync, null); Spacer(Modifier.width(10.dp)); Text("$count payment${if (count == 1) "" else "s"} waiting to sync", fontWeight = FontWeight.Bold) } } }
@Composable private fun EmptyCard(title: String, message: String) { Card { Column(Modifier.padding(22.dp)) { Text(title, fontWeight = FontWeight.Bold); Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant) } } }
@Composable private fun Avatar(name: String) { Box(Modifier.size(42.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape), contentAlignment = Alignment.Center) { Text(name.split(" ").take(2).mapNotNull { it.firstOrNull()?.toString() }.joinToString(""), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.ExtraBold) } }
@Composable private fun StatusPill(status: String) { val color = when (status) { "paid" -> MaterialTheme.colorScheme.primary; "overdue" -> MaterialTheme.colorScheme.error; else -> MaterialTheme.colorScheme.tertiary }; Text(status.replaceFirstChar(Char::uppercase), color = color, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold) }
@Composable private fun BrandMark() { Row(verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(50.dp).background(MaterialTheme.colorScheme.primary, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) { Icon(Icons.Default.Apartment, null, tint = Color.White) }; Spacer(Modifier.width(12.dp)); Column { Text("RentLens", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold); Text("RENT COLLECTION MADE CLEAR", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } } }
@Composable private fun SettingRow(icon: ImageVector, label: String, action: () -> Unit) { Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) { Icon(icon, null); Spacer(Modifier.width(12.dp)); Text(label, Modifier.weight(1f), fontWeight = FontWeight.Medium); TextButton(onClick = action) { Text("Open") } } }

private fun money(value: Double): String = "UGX ${NumberFormat.getIntegerInstance(Locale.US).format(value)}"
private fun dateLabel(value: String): String = runCatching { LocalDate.parse(value.take(10)).format(DateTimeFormatter.ofPattern("d MMM yyyy")) }.getOrDefault(value.take(10))
private fun openWhatsApp(context: android.content.Context, phone: String, message: String) { val digits = phone.filter(Char::isDigit).let { if (it.startsWith("0")) "256${it.drop(1)}" else it }; context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$digits?text=${Uri.encode(message)}"))) }
