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
        val charges = supabase.from("charges").select {
            order("due_date", Order.DESCENDING)
            limit(500)
        }.decodeList<Charge>()
        val messages = supabase.from("message_log").select {
            order("created_at", Order.DESCENDING)
            limit(250)
        }.decodeList<MessageRow>()
        val profile = supabase.from("profiles").select { filter { eq("id", userId) } }.decodeSingle<Profile>()
        val settings = supabase.from("landlord_settings").select {
            filter { eq("landlord_id", userId) }
        }.decodeSingle<LandlordSettings>()
        return RentLensData(profile, tenants, payments, charges, messages, settings, dao.count(userId))
    }

    suspend fun recordPayment(tenant: Tenant, amount: Double, method: String, reference: String?, paidAt: String): Boolean {
        val userId = requireNotNull(currentUserId()) { "Please sign in again." }
        val row = PendingPayment(
            id = UUID.randomUUID().toString(), userId = userId, tenantId = tenant.id,
            tenantName = tenant.fullName, amount = amount, method = method,
            reference = reference?.trim()?.takeIf(String::isNotEmpty), paidAt = paidAt,
        )
        dao.save(row)
        scheduleSync()
        return runCatching { syncOne(row); true }.getOrDefault(false)
    }

    suspend fun syncPending() {
        val userId = currentUserId() ?: return
        dao.pending(userId).forEach { syncOne(it) }
    }

    suspend fun addTenant(name: String, phone: String, property: String, unit: String, rent: Double, dueDay: Int) {
        val parameters = buildJsonObject {
            put("p_full_name", name.trim())
            put("p_phone", phone.trim())
            put("p_property_name", property.trim())
            put("p_unit_name", unit.trim())
            put("p_monthly_rent", rent)
            put("p_due_day", dueDay)
        }
        supabase.postgrest.rpc("add_tenant_with_unit", parameters)
    }

    suspend fun savePromise(tenantId: String, date: String, note: String) {
        val userId = requireNotNull(currentUserId()) { "Please sign in again." }
        supabase.from("payment_promises").insert(buildJsonObject {
            put("landlord_id", userId)
            put("tenant_id", tenantId)
            put("promised_date", date)
            if (note.isNotBlank()) put("note", note.trim())
        })
    }

    suspend fun markMessageSent(messageId: String) {
        supabase.from("message_log").update({
            set("status", "sent")
            set("sent_at", Instant.now().toString())
        }) { filter { eq("id", messageId) } }
    }

    suspend fun reversePayment(paymentId: String, reason: String) {
        supabase.postgrest.rpc("reverse_rent_payment", buildJsonObject {
            put("p_payment_id", paymentId)
            put("p_reason", reason.trim())
        })
    }

    suspend fun saveSettings(profile: Profile, settings: LandlordSettings) {
        val userId = requireNotNull(currentUserId()) { "Please sign in again." }
        supabase.from("profiles").update({
            set("full_name", profile.fullName.trim())
            set("business_name", profile.businessName.trim())
        }) { filter { eq("id", userId) } }
        supabase.from("landlord_settings").update({
            set("remind_days_before", settings.remindDaysBefore)
            set("overdue_repeat_days", settings.overdueRepeatDays)
            set("holiday_messages_enabled", settings.holidayMessagesEnabled)
        }) { filter { eq("landlord_id", userId) } }
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
