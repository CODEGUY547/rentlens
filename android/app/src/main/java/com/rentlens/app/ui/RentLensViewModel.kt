package com.rentlens.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rentlens.app.data.Payment
import com.rentlens.app.data.Profile
import com.rentlens.app.data.Charge
import com.rentlens.app.data.LandlordSettings
import com.rentlens.app.data.MessageRow
import com.rentlens.app.data.RentLensRepository
import com.rentlens.app.data.SupabaseProvider
import com.rentlens.app.data.Tenant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class UiState(
    val configured: Boolean = SupabaseProvider.isConfigured,
    val signedIn: Boolean = false,
    val loading: Boolean = false,
    val profile: Profile = Profile(),
    val tenants: List<Tenant> = emptyList(),
    val payments: List<Payment> = emptyList(),
    val charges: List<Charge> = emptyList(),
    val messages: List<MessageRow> = emptyList(),
    val settings: LandlordSettings = LandlordSettings(),
    val pendingPayments: Int = 0,
    val notice: String? = null,
)

class RentLensViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = RentLensRepository(application)
    private val mutableState = MutableStateFlow(UiState(signedIn = repository.hasSession()))
    val state: StateFlow<UiState> = mutableState.asStateFlow()

    init { if (repository.hasSession()) refresh() }

    fun signIn(email: String, password: String) = launchAction {
        repository.signIn(email, password)
        mutableState.value = mutableState.value.copy(signedIn = true)
        loadData()
    }

    fun signUp(email: String, password: String) = launchAction {
        repository.signUp(email, password)
        val hasSession = repository.hasSession()
        mutableState.value = mutableState.value.copy(
            signedIn = hasSession,
            notice = if (hasSession) "Account created" else "Check your email to confirm the account, then sign in.",
        )
        if (hasSession) loadData()
    }

    fun refresh() = launchAction { loadData() }

    fun recordPayment(tenant: Tenant, amount: Double, method: String, reference: String?, paidAt: String) = launchAction {
        require(amount > 0) { "Enter an amount greater than zero." }
        require(amount <= tenant.balance) { "The payment cannot be more than the outstanding balance." }
        val synced = repository.recordPayment(tenant, amount, method, reference, "${paidAt}T12:00:00+03:00")
        mutableState.value = mutableState.value.copy(
            notice = if (synced) "Payment confirmed and receipt created." else "Saved offline. It will sync automatically.",
        )
        loadData()
    }

    fun addTenant(name: String, phone: String, property: String, unit: String, rent: Double, dueDay: Int) = launchAction {
        require(name.isNotBlank() && phone.isNotBlank() && property.isNotBlank() && unit.isNotBlank()) { "Complete every tenant and unit field." }
        require(rent > 0 && dueDay in 1..28) { "Enter valid rent and a due day from 1 to 28." }
        repository.addTenant(name, phone, property, unit, rent, dueDay)
        loadData()
        mutableState.value = mutableState.value.copy(notice = "Tenant, unit and current rent charge added.")
    }

    fun savePromise(tenantId: String, date: String, note: String) = launchAction {
        require(tenantId.isNotBlank() && date.isNotBlank()) { "Choose a tenant and promised date." }
        repository.savePromise(tenantId, date, note)
        loadData()
        mutableState.value = mutableState.value.copy(notice = "Payment promise saved.")
    }

    fun markMessageSent(messageId: String) = launchAction {
        repository.markMessageSent(messageId)
        loadData()
    }

    fun reversePayment(paymentId: String, reason: String) = launchAction {
        require(reason.trim().length >= 3) { "Enter a clear reversal reason." }
        repository.reversePayment(paymentId, reason)
        loadData()
        mutableState.value = mutableState.value.copy(notice = "Payment reversed; its receipt remains in the audit trail.")
    }

    fun saveSettings(profile: Profile, settings: LandlordSettings) = launchAction {
        require(profile.businessName.isNotBlank()) { "Enter your business name." }
        repository.saveSettings(profile, settings)
        loadData()
        mutableState.value = mutableState.value.copy(notice = "Business and reminder settings saved.")
    }

    fun syncNow() = launchAction {
        repository.syncPending()
        loadData()
        mutableState.value = mutableState.value.copy(notice = "Sync complete.")
    }

    fun signOut() = launchAction {
        repository.signOut()
        mutableState.value = UiState(configured = SupabaseProvider.isConfigured)
    }

    fun clearNotice() { mutableState.value = mutableState.value.copy(notice = null) }

    private suspend fun loadData() {
        val data = repository.load()
        mutableState.value = mutableState.value.copy(
            signedIn = true, profile = data.profile, tenants = data.tenants,
            payments = data.payments, charges = data.charges, messages = data.messages,
            settings = data.settings, pendingPayments = data.pendingPayments,
        )
    }

    private fun launchAction(block: suspend () -> Unit) {
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(loading = true, notice = null)
            runCatching { block() }.onFailure { error ->
                mutableState.value = mutableState.value.copy(notice = error.message ?: "Something went wrong.")
            }
            mutableState.value = mutableState.value.copy(loading = false)
        }
    }
}
