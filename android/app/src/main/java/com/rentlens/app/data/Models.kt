package com.rentlens.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Tenant(
    val id: String,
    @SerialName("full_name") val fullName: String,
    val phone: String,
    @SerialName("unit_name") val unitName: String,
    @SerialName("monthly_rent") val monthlyRent: Double,
    @SerialName("due_day") val dueDay: Int,
    val balance: Double,
    @SerialName("last_payment_at") val lastPaymentAt: String? = null,
    @SerialName("promise_date") val promiseDate: String? = null,
    val status: String,
    @SerialName("whatsapp_opt_in") val whatsappOptIn: Boolean = true,
)

@Serializable
data class Payment(
    val id: String,
    @SerialName("tenant_id") val tenantId: String,
    val amount: Double,
    @SerialName("paid_at") val paidAt: String,
    @SerialName("payment_method") val paymentMethod: String,
    val reference: String? = null,
    @SerialName("receipt_number") val receiptNumber: String,
    @SerialName("balance_after") val balanceAfter: Double? = null,
    @SerialName("voided_at") val voidedAt: String? = null,
    @SerialName("void_reason") val voidReason: String? = null,
    @SerialName("tenant_name_snapshot") val tenantNameSnapshot: String? = null,
    @SerialName("unit_name_snapshot") val unitNameSnapshot: String? = null,
    @SerialName("business_name_snapshot") val businessNameSnapshot: String? = null,
)

@Serializable
data class Charge(
    val id: String,
    @SerialName("tenant_id") val tenantId: String,
    @SerialName("charge_month") val chargeMonth: String,
    @SerialName("due_date") val dueDate: String,
    val description: String,
    val amount: Double,
    @SerialName("paid_amount") val paidAmount: Double,
    val status: String,
)

@Serializable
data class MessageRow(
    val id: String,
    @SerialName("tenant_id") val tenantId: String,
    val type: String,
    val body: String,
    val status: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("failure_reason") val failureReason: String? = null,
)

@Serializable
data class LandlordSettings(
    val currency: String = "UGX",
    val timezone: String = "Africa/Kampala",
    @SerialName("remind_days_before") val remindDaysBefore: Int = 3,
    @SerialName("overdue_repeat_days") val overdueRepeatDays: Int = 7,
    @SerialName("holiday_messages_enabled") val holidayMessagesEnabled: Boolean = false,
)

@Serializable
data class Profile(
    @SerialName("full_name") val fullName: String = "",
    @SerialName("business_name") val businessName: String = "My Rentals",
)

@Serializable
data class RecordPaymentParams(
    @SerialName("p_tenant_id") val tenantId: String,
    @SerialName("p_amount") val amount: Double,
    @SerialName("p_payment_method") val paymentMethod: String,
    @SerialName("p_reference") val reference: String? = null,
    @SerialName("p_paid_at") val paidAt: String,
    @SerialName("p_idempotency_key") val idempotencyKey: String,
)

@Serializable
data class PaymentResult(
    val id: String,
    @SerialName("receipt_number") val receiptNumber: String,
    @SerialName("balance_after") val balanceAfter: Double? = null,
    val duplicate: Boolean = false,
)

data class RentLensData(
    val profile: Profile = Profile(),
    val tenants: List<Tenant> = emptyList(),
    val payments: List<Payment> = emptyList(),
    val charges: List<Charge> = emptyList(),
    val messages: List<MessageRow> = emptyList(),
    val settings: LandlordSettings = LandlordSettings(),
    val pendingPayments: Int = 0,
)
