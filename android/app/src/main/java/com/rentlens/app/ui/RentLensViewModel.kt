package com.rentlens.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rentlens.app.data.Payment
import com.rentlens.app.data.Profile
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

    fun recordPayment(tenant: Tenant, amount: Double, method: String, reference: String?) = launchAction {
        require(amount > 0) { "Enter an amount greater than zero." }
        val synced = repository.recordPayment(tenant, amount, method, reference)
        mutableState.value = mutableState.value.copy(
            notice = if (synced) "Payment confirmed and receipt created." else "Saved offline. It will sync automatically.",
        )
        loadData()
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
            payments = data.payments, pendingPayments = data.pendingPayments,
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
