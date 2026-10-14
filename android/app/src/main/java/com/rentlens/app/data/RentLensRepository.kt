package com.rentlens.app.data

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import java.util.UUID

class RentLensRepository(context: Context) {
    private val appContext = context.applicationContext
    private val dao = OfflineDatabase.get(appContext).dao()
    private val supabase get() = SupabaseProvider.client

    fun hasSession(): Boolean = SupabaseProvider.isConfigured && supabase.auth.currentSessionOrNull() != null
    fun currentUserId(): String? = if (SupabaseProvider.isConfigured) supabase.auth.currentUserOrNull()?.id else null

    suspend fun signIn(email: String, password: String) {
        supabase.auth.signInWith(Email) { this.email = email.trim(); this.password = password }
    }

    suspend fun signUp(email: String, password: String) {
        supabase.auth.signUpWith(Email) { this.email = email.trim(); this.password = password }
    }

    suspend fun signOut() = supabase.auth.signOut()

    suspend fun load(): RentLensData {
        val userId = requireNotNull(currentUserId()) { "Please sign in again." }
        runCatching { syncPending() }
        val tenants = supabase.from("tenant_overview").select { order("full_name", Order.ASCENDING) }.decodeList<Tenant>()
        val payments = supabase.from("payments").select {
            order("paid_at", Order.DESCENDING)
            limit(250)
        }.decodeList<Payment>()
        val profile = supabase.from("profiles").select { filter { eq("id", userId) } }.decodeSingle<Profile>()
        return RentLensData(profile, tenants, payments, dao.count(userId))
    }

    suspend fun recordPayment(tenant: Tenant, amount: Double, method: String, reference: String?): Boolean {
        val userId = requireNotNull(currentUserId()) { "Please sign in again." }
        val row = PendingPayment(
            id = UUID.randomUUID().toString(), userId = userId, tenantId = tenant.id,
            tenantName = tenant.fullName, amount = amount, method = method,
            reference = reference?.trim()?.takeIf(String::isNotEmpty), paidAt = Instant.now().toString(),
        )
        dao.save(row)
        scheduleSync()
        return runCatching { syncOne(row); true }.getOrDefault(false)
    }

    suspend fun syncPending() {
        val userId = currentUserId() ?: return
        dao.pending(userId).forEach { syncOne(it) }
    }

    private suspend fun syncOne(row: PendingPayment) {
        try {
            val parameters = buildJsonObject {
                put("p_tenant_id", row.tenantId)
                put("p_amount", row.amount)
                put("p_payment_method", row.method)
                row.reference?.let { put("p_reference", it) }
                put("p_paid_at", row.paidAt)
                put("p_idempotency_key", row.id)
            }
            supabase.postgrest.rpc("record_rent_payment_v2", parameters)
            dao.remove(row.id)
        } catch (error: Throwable) {
            dao.save(row.copy(attempts = row.attempts + 1, lastError = error.message))
            throw error
        }
    }

    private fun scheduleSync() {
        val request = OneTimeWorkRequestBuilder<OfflineSyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
        WorkManager.getInstance(appContext).enqueueUniqueWork("rentlens-payment-sync", ExistingWorkPolicy.KEEP, request)
    }
}
