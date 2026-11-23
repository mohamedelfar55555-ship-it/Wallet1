package com.demo.wallet.simulator.plugins

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
    name = "SimInfo",
    permissions = [
        Permission(
            alias = "phoneState",
            strings = [Manifest.permission.READ_PHONE_STATE]
        ),
        Permission(
            alias = "phoneNumbers",
            strings = [Manifest.permission.READ_PHONE_NUMBERS]
        )
    ]
)
class SimInfoPlugin : Plugin() {

    @PluginMethod
    fun requestPermissionsAndGetSims(call: PluginCall) {
        if (!hasRequiredPermissions()) {
            val aliases = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                arrayOf("phoneState", "phoneNumbers")
            } else {
                arrayOf("phoneState")
            }
            requestPermissionForAliases(aliases, call, "simPermissionsCallback")
            return
        }
        resolveSims(call)
    }

    @PermissionCallback
    private fun simPermissionsCallback(call: PluginCall) {
        if (hasRequiredPermissions()) {
            resolveSims(call)
        } else {
            val result = JSObject()
            result.put("permissionStatus", "denied")
            result.put("subscriptions", JSArray())
            result.put(
                "note",
                "User denied READ_PHONE_STATE / READ_PHONE_NUMBERS permission. Manual phone entry remains available."
            )
            call.resolve(result)
        }
    }

    private fun hasRequiredPermissions(): Boolean {
        val stateGranted = getPermissionState("phoneState") == PermissionState.GRANTED
        val numbersGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getPermissionState("phoneNumbers") == PermissionState.GRANTED
        } else {
            true
        }
        return stateGranted && numbersGranted
    }

    @SuppressLint("MissingPermission")
    private fun resolveSims(call: PluginCall) {
        val context = context
        val subManager =
            context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
        val telManager =
            context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager

        val simsArray = JSArray()

        if (subManager == null) {
            val result = JSObject()
            result.put("permissionStatus", "granted")
            result.put("subscriptions", simsArray)
            result.put("note", "SubscriptionManager is unavailable on this device.")
            call.resolve(result)
            return
        }

        val activeList: List<SubscriptionInfo> = try {
            if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.READ_PHONE_STATE
                ) == PackageManager.PERMISSION_GRANTED
            ) {
                subManager.activeSubscriptionInfoList ?: emptyList()
            } else {
                emptyList()
            }
        } catch (_: SecurityException) {
            emptyList()
        }

        val defaultSmsSubId = SubscriptionManager.getDefaultSmsSubscriptionId()
        val defaultDataSubId = SubscriptionManager.getDefaultDataSubscriptionId()

        for (info in activeList) {
            val item = JSObject()
            item.put("subscriptionId", info.subscriptionId)
            item.put("slotIndex", info.simSlotIndex)
            item.put("carrierName", info.carrierName?.toString() ?: "Unknown Carrier")
            item.put("displayName", info.displayName?.toString() ?: "SIM ${info.simSlotIndex + 1}")
            item.put("countryIso", info.countryIso ?: "")

            val mccMnc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                "${info.mccString ?: ""}${info.mncString ?: ""}"
            } else {
                @Suppress("DEPRECATION")
                "${info.mcc}${info.mnc}"
            }
            item.put("mccMnc", mccMnc)
            item.put("isDefaultSms", info.subscriptionId == defaultSmsSubId)
            item.put("isDefaultData", info.subscriptionId == defaultDataSubId)

            var number: String? = null
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    number = subManager.getPhoneNumber(info.subscriptionId)
                }
                if (number.isNullOrBlank()) {
                    @Suppress("DEPRECATION")
                    number = info.number
                }
                if (number.isNullOrBlank() && telManager != null && activeList.size == 1) {
                    @Suppress("DEPRECATION")
                    number = telManager.line1Number
                }
            } catch (_: SecurityException) {
                number = null
            }

            if (!number.isNullOrBlank()) {
                item.put("phoneNumber", number)
                item.put("phoneNumberSource", "carrier")
            } else {
                item.put("phoneNumber", "")
                item.put("phoneNumberSource", "hidden_by_os")
            }

            simsArray.put(item)
        }

        val result = JSObject()
        result.put("permissionStatus", "granted")
        result.put("subscriptions", simsArray)
        call.resolve(result)
    }
}
