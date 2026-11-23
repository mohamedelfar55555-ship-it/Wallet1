package com.demo.wallet.simulator.plugins

import android.graphics.BitmapFactory
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

@CapacitorPlugin(name = "MlKitOcr")
class MlKitOcrPlugin : Plugin() {

    @PluginMethod
    fun recognizeText(call: PluginCall) {
        val base64 = call.getString("imageBase64")
        if (base64.isNullOrBlank()) {
            call.reject("Missing imageBase64 payload.")
            return
        }

        val bytes = try {
            Base64.decode(base64, Base64.DEFAULT)
        } catch (_: IllegalArgumentException) {
            call.reject("Invalid base64 image.")
            return
        }

        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        if (bitmap == null) {
            call.reject("Could not decode image bitmap.")
            return
        }

        val image = InputImage.fromBitmap(bitmap, 0)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

        recognizer.process(image)
            .addOnSuccessListener { visionText ->
                val result = JSObject()
                result.put("text", visionText.text)
                result.put("engine", "Android ML Kit Text Recognition")
                call.resolve(result)
            }
            .addOnFailureListener { exc ->
                call.reject("ML Kit OCR failed: ${exc.localizedMessage}")
            }
    }
}
