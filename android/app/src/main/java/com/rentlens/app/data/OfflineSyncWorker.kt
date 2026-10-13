package com.rentlens.app.data

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class OfflineSyncWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result = try {
        val repository = RentLensRepository(applicationContext)
        if (repository.hasSession()) repository.syncPending()
        Result.success()
    } catch (_: Throwable) {
        if (runAttemptCount < 8) Result.retry() else Result.failure()
    }
}
