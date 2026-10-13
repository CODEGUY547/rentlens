package com.rentlens.app.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase

@Entity(tableName = "pending_payments")
data class PendingPayment(
    @PrimaryKey val id: String,
    val userId: String,
    val tenantId: String,
    val tenantName: String,
    val amount: Double,
    val method: String,
    val reference: String?,
    val paidAt: String,
    val attempts: Int = 0,
    val lastError: String? = null,
)

@Dao
interface OfflineDao {
    @Query("SELECT * FROM pending_payments WHERE userId=:userId ORDER BY paidAt")
    suspend fun pending(userId: String): List<PendingPayment>
    @Query("SELECT COUNT(*) FROM pending_payments WHERE userId=:userId")
    suspend fun count(userId: String): Int
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(payment: PendingPayment)
    @Query("DELETE FROM pending_payments WHERE id=:id")
    suspend fun remove(id: String)
}

@Database(entities = [PendingPayment::class], version = 1, exportSchema = false)
abstract class OfflineDatabase : RoomDatabase() {
    abstract fun dao(): OfflineDao
    companion object {
        @Volatile private var instance: OfflineDatabase? = null
        fun get(context: Context): OfflineDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context.applicationContext, OfflineDatabase::class.java, "rentlens-offline.db")
                .build().also { instance = it }
        }
    }
}
