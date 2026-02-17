package com.payfine.warden

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log

/**
 * Sunmi Scanner Helper
 * 
 * Manages the built-in 2D scanner on Sunmi V2 POS devices.
 * Provides both Intent-based and BroadcastReceiver-based scanning.
 * 
 * USAGE:
 * 1. Initialize: ScannerHelper.init(context, callback)
 * 2. Start scan: ScannerHelper.startScan()
 * 3. Receive results via callback or window.onScanResult in WebView
 * 
 * COMPATIBILITY:
 * Sunmi V2, V2 Pro, T2, T2 Lite, P2, P2 Pro series
 * 
 * SCANNER ACTIONS:
 * - Intent action: "com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED"
 * - Extra key: "data" or "SCAN_BARCODE1"
 */
object ScannerHelper {
    
    private const val TAG = "ScannerHelper"
    
    // Sunmi scanner package and actions
    const val SCANNER_PACKAGE = "com.sunmi.scanner"
    const val ACTION_START_SCAN = "com.sunmi.scanner.ACTION_START_SCAN"
    const val ACTION_DATA_RECEIVED = "com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED"
    const val ACTION_SCAN_POWER_KEY = "com.sunmi.scanner.ACTION_SCAN_POWER_KEY"
    
    // Extras
    const val EXTRA_DATA = "data"
    const val EXTRA_BARCODE1 = "SCAN_BARCODE1"
    const val EXTRA_BARCODE2 = "SCAN_BARCODE2"
    const val EXTRA_BARCODE_TYPE = "BARCODE_TYPE"
    
    // Callback interface for scan results
    interface ScanCallback {
        fun onScanResult(code: String, barcodeType: String = "UNKNOWN")
        fun onScanError(error: String)
    }
    
    private var context: Context? = null
    private var callback: ScanCallback? = null
    private var broadcastReceiver: BroadcastReceiver? = null
    private var isRegistered = false
    
    /**
     * Initialize scanner helper
     * Should be called in Activity.onCreate()
     * 
     * @param ctx Application or Activity context
     * @param scanCallback Callback for scan results
     */
    fun init(ctx: Context, scanCallback: ScanCallback) {
        context = ctx.applicationContext
        callback = scanCallback
        
        Log.d(TAG, "ScannerHelper initialized")
        
        // Register broadcast receiver
        registerReceiver()
    }
    
    /**
     * Register broadcast receiver for scan results
     */
    private fun registerReceiver() {
        if (isRegistered) {
            Log.d(TAG, "Receiver already registered")
            return
        }
        
        broadcastReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Intent?, intent: Intent?) {
                intent?.let { processScanIntent(it) }
            }
        }
        
        val filter = IntentFilter().apply {
            addAction(ACTION_DATA_RECEIVED)
            addAction(ACTION_SCAN_POWER_KEY)
        }
        
        try {
            context?.registerReceiver(broadcastReceiver, filter)
            isRegistered = true
            Log.d(TAG, "Broadcast receiver registered")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register receiver", e)
        }
    }
    
    /**
     * Process incoming scan intent
     */
    private fun processScanIntent(intent: Intent) {
        when (intent.action) {
            ACTION_DATA_RECEIVED -> {
                // Get scanned data from extras
                val code = intent.getStringExtra(EXTRA_DATA) 
                    ?: intent.getStringExtra(EXTRA_BARCODE1)
                    ?: intent.getStringExtra(EXTRA_BARCODE2)
                    ?: return
                
                val barcodeType = intent.getStringExtra(EXTRA_BARCODE_TYPE) ?: "UNKNOWN"
                
                Log.d(TAG, "Scan received: $code (type: $barcodeType)")
                
                // Notify callback
                callback?.onScanResult(code, barcodeType)
                
                // Also send to WebView via injected function
                sendToWebView(code, barcodeType)
            }
            
            ACTION_SCAN_POWER_KEY -> {
                // Handle scan button press on device
                Log.d(TAG, "Scan button pressed")
                callback?.onScanResult("", "POWER_KEY_PRESS")
            }
        }
    }
    
    /**
     * Start scanning using Intent
     * Opens the Sunmi scanner app/overlay
     * 
     * @return true if scanner was launched successfully
     */
    fun startScan(): Boolean {
        val ctx = context ?: return false
        
        try {
            val intent = Intent().apply {
                setPackage(SCANNER_PACKAGE)
                action = ACTION_START_SCAN
            }
            
            // Check if scanner app is available
            if (intent.resolveActivity(ctx.packageManager) != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                ctx.startActivity(intent)
                Log.d(TAG, "Scanner intent launched")
                return true
            } else {
                Log.e(TAG, "Scanner app not found")
                callback?.onScanError("Scanner app not installed")
                return false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start scanner", e)
            callback?.onScanError("Failed to start scanner: ${e.message}")
            return false
        }
    }
    
    /**
     * Check if scanner is available
     */
    fun isScannerAvailable(): Boolean {
        val ctx = context ?: return false
        
        val intent = Intent().apply {
            setPackage(SCANNER_PACKAGE)
            action = ACTION_START_SCAN
        }
        
        return intent.resolveActivity(ctx.packageManager) != null
    }
    
    /**
     * Get scanner package name
     */
    fun getScannerPackageName(): String {
        return SCANNER_PACKAGE
    }
    
    /**
     * Send scan result to WebView
     * This will call window.onScanResult(code) in JavaScript
     * 
     * @param code Scanned barcode/QR code
     * @param type Barcode type (e.g., QR_CODE, CODE128)
     */
    private fun sendToWebView(code: String, type: String) {
        try {
            // The WebView will inject this via evaluateJavascript
            // We'll store it and MainActivity will handle the injection
            ScanResultHolder.lastScanResult = code
            ScanResultHolder.lastScanType = type
            ScanResultHolder.timestamp = System.currentTimeMillis()
        } catch (e: Exception) {
            Log.e(TAG, "Error storing scan result", e)
        }
    }
    
    /**
     * Unregister broadcast receiver
     * Should be called in Activity.onDestroy()
     */
    fun unregister() {
        if (isRegistered && broadcastReceiver != null) {
            try {
                context?.unregisterReceiver(broadcastReceiver)
                Log.d(TAG, "Broadcast receiver unregistered")
            } catch (e: Exception) {
                Log.e(TAG, "Error unregistering receiver", e)
            }
            isRegistered = false
            broadcastReceiver = null
        }
        
        context = null
        callback = null
    }
    
    /**
     * Cleanup
     * Call in Activity.onDestroy()
     */
    fun destroy() {
        unregister()
        ScanResultHolder.clear()
        Log.d(TAG, "ScannerHelper destroyed")
    }
}

/**
 * Holder for latest scan result
 * Used to pass data from BroadcastReceiver to WebView
 */
object ScanResultHolder {
    var lastScanResult: String? = null
    var lastScanType: String? = null
    var timestamp: Long = 0
    
    fun hasNewResult(): Boolean {
        return lastScanResult != null && timestamp > 0
    }
    
    fun getAndClear(): Pair<String, String>? {
        val result = lastScanResult ?: return null
        val type = lastScanType ?: "UNKNOWN"
        clear()
        return result to type
    }
    
    fun clear() {
        lastScanResult = null
        lastScanType = null
        timestamp = 0
    }
}

