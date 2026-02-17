package com.payfine.warden

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.webkit.*
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.payfine.warden.models.OffenceTicket
import org.json.JSONObject

/**
 * Main Activity - WebView Container with Printer Bridge
 * 
 * This activity loads the PayFine web app in a WebView and exposes
 * native printer functions to JavaScript via a bridge interface.
 * 
 * JAVASCRIPT BRIDGE:
 * The web app can call:
 * - window.SunmiPrinter.printTicket(ticketJson)
 * - window.SunmiPrinter.getPrinterStatus()
 * - window.SunmiPrinter.testPrint()
 * 
 * WEBVIEW CONFIGURATION:
 * - JavaScript enabled
 * - DOM storage enabled
 * - File access enabled (for local assets)
 * - Mixed content allowed (for development)
 */
class MainActivity : AppCompatActivity() {
    
    private lateinit var webView: WebView
    
    companion object {
        private const val TAG = "MainActivity"
        
        // Web app URL - change this to your production URL
        // For development: "http://10.0.2.2:3000" (Android emulator)
        // For production: "https://your-domain.com"
        private const val WEB_APP_URL = "http://10.0.2.2:3000"
        
        // Alternative: Load from local assets
        // private const val WEB_APP_URL = "file:///android_asset/index.html"
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Initialize printer service
        PrinterHelper.init(this)
        
        // Setup WebView
        setupWebView()
        
        // Load web app
        webView.loadUrl(WEB_APP_URL)
        
        Log.d(TAG, "MainActivity created, loading: $WEB_APP_URL")
    }
    
    /**
     * Setup WebView with JavaScript bridge
     */
    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView = WebView(this)
        setContentView(webView)
        
        // WebView settings
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            
            // Enable debugging in Chrome DevTools (remove in production)
            WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
            
            // Mixed content (HTTP + HTTPS) - for development only
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            
            // Cache settings
            cacheMode = WebSettings.LOAD_DEFAULT
            
            // Viewport settings for responsive design
            useWideViewPort = true
            loadWithOverviewMode = true
            
            // Zoom settings
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
        }
        
        // Add JavaScript interface for printer
        webView.addJavascriptInterface(PrinterBridge(), "SunmiPrinter")
        
        // WebView client for page navigation
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                // Allow all navigation within the app
                return false
            }
            
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "Page loaded: $url")
                
                // Inject printer status on page load
                injectPrinterStatus()
            }
            
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                Log.e(TAG, "WebView error: ${error?.description}")
                
                // Show error page
                val errorHtml = """
                    <html>
                    <body style="font-family: sans-serif; padding: 20px; text-align: center;">
                        <h2>⚠️ Connection Error</h2>
                        <p>Could not load PayFine Warden Portal</p>
                        <p><strong>URL:</strong> ${request?.url}</p>
                        <p><strong>Error:</strong> ${error?.description}</p>
                        <br>
                        <p>Please check:</p>
                        <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                            <li>Internet connection</li>
                            <li>Server is running</li>
                            <li>URL is correct in MainActivity.kt</li>
                        </ul>
                        <br>
                        <button onclick="location.reload()" style="padding: 10px 20px; font-size: 16px;">
                            Retry
                        </button>
                    </body>
                    </html>
                """.trimIndent()
                
                view?.loadDataWithBaseURL(null, errorHtml, "text/html", "UTF-8", null)
            }
        }
        
        // WebChrome client for console logs and alerts
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                consoleMessage?.let {
                    Log.d(TAG, "WebView Console: ${it.message()} (${it.sourceId()}:${it.lineNumber()})")
                }
                return true
            }
            
            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_LONG).show()
                result?.confirm()
                return true
            }
        }
    }
    
    /**
     * Inject printer status into web page
     * Makes printer info available to JavaScript
     */
    private fun injectPrinterStatus() {
        val status = PrinterHelper.getPrinterStatus()
        val statusText = PrinterHelper.getPrinterStatusText()
        val isReady = PrinterHelper.isPrinterReady()
        
        val js = """
            window.sunmiPrinterStatus = {
                status: $status,
                statusText: "$statusText",
                isReady: $isReady,
                timestamp: ${System.currentTimeMillis()}
            };
            console.log('Sunmi Printer Status:', window.sunmiPrinterStatus);
        """.trimIndent()
        
        webView.evaluateJavascript(js, null)
    }
    
    /**
     * JavaScript Bridge Interface
     * Exposes printer functions to web app
     */
    inner class PrinterBridge {
        
        /**
         * Print ticket from JavaScript
         * 
         * USAGE FROM WEB:
         * window.SunmiPrinter.printTicket(JSON.stringify({
         *   serialNumber: "A123456",
         *   offenceDesc: "Speeding 15 km/h over limit",
         *   location: "Highway 1",
         *   plate: "BDS-1234",
         *   amount: 150.00,
         *   dateTime: "2024-01-29T14:30:00",
         *   dueDate: "2024-02-19",
         *   points: 2,
         *   courtRequired: false,
         *   qrUrl: "https://payfine.example.com/pay?serial=A123456"
         * }));
         */
        @JavascriptInterface
        fun printTicket(ticketJson: String): Boolean {
            Log.d(TAG, "printTicket called with: $ticketJson")
            
            return try {
                val json = JSONObject(ticketJson)
                val ticket = OffenceTicket.fromJson(json)
                
                // Print on main thread
                runOnUiThread {
                    PrinterHelper.printTicket(ticket, this@MainActivity)
                }
                
                true
            } catch (e: Exception) {
                Log.e(TAG, "Error printing ticket", e)
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Print error: ${e.message}", Toast.LENGTH_LONG).show()
                }
                false
            }
        }
        
        /**
         * Get printer status
         * Returns JSON string with status info
         */
        @JavascriptInterface
        fun getPrinterStatus(): String {
            val status = PrinterHelper.getPrinterStatus()
            val statusText = PrinterHelper.getPrinterStatusText()
            val isReady = PrinterHelper.isPrinterReady()
            
            return JSONObject().apply {
                put("status", status)
                put("statusText", statusText)
                put("isReady", isReady)
                put("timestamp", System.currentTimeMillis())
            }.toString()
        }
        
        /**
         * Test print function
         * Prints a test receipt to verify printer works
         */
        @JavascriptInterface
        fun testPrint(): Boolean {
            Log.d(TAG, "testPrint called")
            
            runOnUiThread {
                PrinterHelper.printTestReceipt(this@MainActivity)
            }
            
            return true
        }
        
        /**
         * Check if printer is ready
         */
        @JavascriptInterface
        fun isPrinterReady(): Boolean {
            return PrinterHelper.isPrinterReady()
        }
        
        /**
         * Get printer status text
         */
        @JavascriptInterface
        fun getPrinterStatusText(): String {
            return PrinterHelper.getPrinterStatusText()
        }
    }
    
    /**
     * Handle back button
     * Navigate back in WebView history if possible
     */
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
    
    /**
     * Cleanup on destroy
     */
    override fun onDestroy() {
        super.onDestroy()
        
        // Unbind printer service
        PrinterHelper.unbind(this)
        
        // Cleanup WebView
        webView.destroy()
    }
}
