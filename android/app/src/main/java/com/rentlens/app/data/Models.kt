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
    val pendingPayments: Int = 0,
)
