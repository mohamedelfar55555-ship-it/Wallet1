package com.demo.wallet.simulator.plugins

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ShareBridge")
class ShareBridgePlugin : Plugin() {

    private var pendingPayload: JSObject? = null

    override fun handleOnNewIntent(intent: Intent?) {
        super.handleOnNewIntent(intent)
        if (intent != null) {
            captureShareIntent(intent)
        }
    }

    override fun load() {
        super.load()
        activity?.intent?.let { captureShareIntent(it) }
    }

    private fun captureShareIntent(intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) return

        val payload = JSObject()
        payload.put("hasPayload", true)
        payload.put("title", intent.getStringExtra(Intent.EXTRA_SUBJECT) ?: "")
        payload.put("text", intent.getStringExtra(Intent.EXTRA_TEXT) ?: "")
        payload.put("mimeType", intent.type ?: "text/plain")

        val streamUri: Uri? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }

        if (streamUri != null) {
            try {
                context.contentResolver.openInputStream(streamUri)?.use { input ->
                    val bytes = input.readBytes()
                    if (bytes.size <= 6 * 1024 * 1024) {
                        payload.put("fileBase64", Base64.encodeToString(bytes, Base64.NO_WRAP))
                        payload.put("fileName", resolveDisplayName(streamUri) ?: "shared-item")
                    }
                }
            } catch (_: Exception) {
                // Ignore unreadable stream URI
            }
        }

        pendingPayload = payload
    }

    private fun resolveDisplayName(uri: Uri): String? {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIdx >= 0 && cursor.moveToFirst()) {
                return cursor.getString(nameIdx)
            }
        }
        return uri.lastPathSegment
    }

    @PluginMethod
    fun getPendingSharedPayload(call: PluginCall) {
        val result = pendingPayload ?: JSObject().apply { put("hasPayload", false) }
        call.resolve(result)
    }

    @PluginMethod
    fun clearPendingSharedPayload(call: PluginCall) {
        pendingPayload = null
        call.resolve()
    }
}
