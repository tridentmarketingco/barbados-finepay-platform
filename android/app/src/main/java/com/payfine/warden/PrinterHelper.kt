package com.payfine.warden

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.os.RemoteException
import android.util.Log
import android.widget.Toast
import com.payfine.warden.models.OffenceTicket
import woyou.aidlservice.jiuiv5.ICallback
import woyou.aidlservice.jiuiv5.IWoyouService

/**
 * Sunmi Printer Helper
 * 
 * Manages connection to Sunmi's built-in thermal printer via AIDL service.
 * Provides high-level printing functions for traffic tickets with QR codes.
 * 
 * USAGE:
 * 1. Initialize: PrinterHelper.init(context)
 * 2. Print ticket: PrinterHelper.printTicket(ticket, context)
 * 3. Check status: PrinterHelper.getPrinterStatus()
 * 
 * TRANSACTION MODE:
 * Uses enterPrinterBuffer() → commands → commitPrinterBuffer() for atomic operations.
 * This ensures all commands execute together or rollback on error.
 * 
 * COMPATIBILITY:
 * Tested on Sunmi V2, V2 Pro, T2, T2 Lite, P2, P2 Pro
 * Should work on all Sunmi devices with built-in thermal printers.
 */
object PrinterHelper {
    
    private const val TAG = "PrinterHelper"
    
    // Sunmi printer service package and action
    private const val SERVICE_PACKAGE = "woyou.aidlservice.jiuiv5"
    private const val SERVICE_ACTION = "woyou.aidlservice.jiuiv5.IWoyouService"
    
    // Printer service instance
    private var printerService: IWoyouService? = null
    private var isServiceBound = false
    
    // Paper width detection (58mm or 80mm)
    private var paperWidth: Int = 58 // Default to 58mm
    
    /**
     * Service connection callback
     * Called when service binds/unbinds
     */
    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            Log.d(TAG, "Printer service connected")
            printerService = IWoyouService.Stub.asInterface(service)
            isServiceBound = true
            
            // Initialize printer and detect paper width
            try {
                printerService?.printerInit(object : ICallback.Stub() {
                    override fun onRunResult(isSuccess: Boolean) {
                        Log.d(TAG, "Printer init: $isSuccess")
                    }
                    override fun onReturnString(data: String?) {
                        Log.d(TAG, "Printer init data: $data")
                    }
                    override fun onPrintResult(isSuccess: Boolean) {
                        Log.d(TAG, "Printer init result: $isSuccess")
                    }
                })
                
                // Detect paper width (1=58mm, 2=80mm)
                val paperType = printerService?.printerPaper ?: 1
                paperWidth = if (paperType == 2) 80 else 58
                Log.d(TAG, "Paper width detected: ${paperWidth}mm")
                
            } catch (e: RemoteException) {
                Log.e(TAG, "Failed to initialize printer", e)
            }
        }
        
        override fun onServiceDisconnected(name: ComponentName?) {
            Log.d(TAG, "Printer service disconnected")
            printerService = null
            isServiceBound = false
        }
    }
    
    /**
     * Initialize printer service
     * Call this in Application.onCreate() or Activity.onCreate()
     */
    fun init(context: Context) {
        if (isServiceBound) {
            Log.d(TAG, "Printer service already bound")
            return
        }
        
        try {
            val intent = Intent().apply {
                setPackage(SERVICE_PACKAGE)
                action = SERVICE_ACTION
            }
            
            val bound = context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
            if (bound) {
                Log.d(TAG, "Binding to printer service...")
            } else {
                Log.e(TAG, "Failed to bind printer service")
                Toast.makeText(context, "Printer service not available", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error binding printer service", e)
            Toast.makeText(context, "Error connecting to printer: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
    
    /**
     * Unbind printer service
     * Call this in Activity.onDestroy() if needed
     */
    fun unbind(context: Context) {
        if (isServiceBound) {
            try {
                context.unbindService(serviceConnection)
                isServiceBound = false
                printerService = null
                Log.d(TAG, "Printer service unbound")
            } catch (e: Exception) {
                Log.e(TAG, "Error unbinding printer service", e)
            }
        }
    }
    
    /**
     * Get printer status
     * Returns: 1=normal, 2=preparing, 3=abnormal, 4=out of paper, 
     *          5=overheated, 6=cover open, 7=cutter error, 505=not detected
     */
    fun getPrinterStatus(): Int {
        return try {
            printerService?.updatePrinterState() ?: 505
        } catch (e: RemoteException) {
            Log.e(TAG, "Error getting printer status", e)
            505
        }
    }
    
    /**
     * Get printer status as human-readable string
     */
    fun getPrinterStatusText(): String {
        return when (getPrinterStatus()) {
            1 -> "Ready"
            2 -> "Preparing..."
            3 -> "Communication Error"
            4 -> "Out of Paper"
            5 -> "Overheated"
            6 -> "Cover Open"
            7 -> "Cutter Error"
            8 -> "Cutter Recovered"
            9 -> "Black Mark Not Detected"
            505 -> "Printer Not Detected"
            else -> "Unknown Status"
        }
    }
    
    /**
     * Check if printer is ready
     */
    fun isPrinterReady(): Boolean {
        val status = getPrinterStatus()
        return status == 1 || status == 2
    }
    
    /**
     * Print traffic ticket
     * Main function to print complete thermal receipt
     * Supports both new format (title, amount, plate, date, warden, location)
     * and legacy format (serialNumber, offenceDesc, etc.)
     * 
     * @param ticket OffenceTicket data
     * @param context Android context for Toast messages
     */
    fun printTicket(ticket: OffenceTicket, context: Context) {
        if (!isServiceBound || printerService == null) {
            Toast.makeText(context, "Printer not connected. Please restart app.", Toast.LENGTH_LONG).show()
            Log.e(TAG, "Printer service not bound")
            return
        }
        
        // Check printer status
        val status = getPrinterStatus()
        if (status != 1 && status != 2) {
            Toast.makeText(context, "Printer error: ${getPrinterStatusText()}", Toast.LENGTH_LONG).show()
            Log.e(TAG, "Printer not ready: status=$status")
            return
        }
        
        try {
            Log.d(TAG, "Starting ticket print: ${ticket.getSerialNumber()}")
            
            // Enter transaction mode (buffer all commands)
            printerService?.enterPrinterBuffer(true, null)
            
            // Print header
            printHeader(ticket)
            
            // Print ticket details
            printTicketDetails(ticket)
            
            // Print QR code if URL available
            if (ticket.qrUrl.isNotEmpty()) {
                printQRCode(ticket)
            }
            
            // Print barcode (fallback)
            printBarcode(ticket)
            
            // Print footer
            printFooter(ticket)
            
            // Feed paper and cut
            feedAndCut()
            
            // Commit transaction (execute all commands)
            printerService?.commitPrinterBuffer(object : ICallback.Stub() {
                override fun onRunResult(isSuccess: Boolean) {
                    if (isSuccess) {
                        Log.d(TAG, "Print job completed successfully")
                        Toast.makeText(context, "✅ Ticket printed", Toast.LENGTH_SHORT).show()
                    } else {
                        Log.e(TAG, "Print job failed")
                        Toast.makeText(context, "❌ Print failed. Please try again.", Toast.LENGTH_LONG).show()
                    }
                }
                
                override fun onReturnString(data: String?) {
                    Log.d(TAG, "Print return: $data")
                }
                
                override fun onPrintResult(isSuccess: Boolean) {
                    Log.d(TAG, "Print result: $isSuccess")
                }
            })
            
        } catch (e: RemoteException) {
            Log.e(TAG, "Print error", e)
            Toast.makeText(context, "Print error: ${e.message}", Toast.LENGTH_LONG).show()
            
            // Rollback transaction on error
            try {
                printerService?.exitPrinterBuffer(false, null)
            } catch (ex: Exception) {
                Log.e(TAG, "Error rolling back print job", ex)
            }
        }
    }
    
    /**
     * Print ticket header
     * Bold, centered government name and title
     */
    private fun printHeader(ticket: OffenceTicket) {
        // Center alignment
        printerService?.setAlignment(1, null)
        
        // Government name
        printerService?.printTextWithFont("${ticket.governmentName}\n", null, 24, null)
        
        // Ticket title (from new format or default)
        printerService?.printTextWithFont("${ticket.title}\n", null, 32, null)
        
        // Date (from new format or legacy dateTime)
        val displayDate = ticket.date ?: ticket.dateTime
        if (displayDate.isNotEmpty()) {
            printerService?.printTextWithFont("${formatDate(displayDate)}\n", null, 22, null)
        }
        
        // Separator line
        printerService?.printText("${"-".repeat(if (paperWidth == 80) 48 else 32)}\n", null)
        printerService?.printText("\n", null)
    }
    
    /**
     * Print ticket details section
     * Supports both new format (title, amount, plate, date, warden, location)
     * and legacy format (serialNumber, offenceDesc, etc.)
     */
    private fun printTicketDetails(ticket: OffenceTicket) {
        // Left alignment
        printerService?.setAlignment(0, null)
        
        // Check if using new format (has title field that's not default)
        val isNewFormat = ticket.title.isNotEmpty() && 
                         ticket.title != "PAYFINE TICKET" && 
                         ticket.title != "TRAFFIC OFFENCE TICKET"
        
        if (isNewFormat) {
            // NEW FORMAT (from requirements)
            // title: "PAYFINE TICKET"
            // amount: "50.00"
            // plate: "ABC123"
            // date: "2026-02-09"
            // warden: "DJ Blank"
            // location: "Bridgetown"
            
            printerService?.printText("\n", null)
            
            // Warden
            if (!ticket.warden.isNullOrEmpty()) {
                printerService?.printText("WARDEN: ${ticket.warden}\n", null)
            }
            
            // Location
            if (!ticket.location.isNullOrEmpty()) {
                printerService?.printText("LOCATION: ${ticket.location}\n", null)
            }
            
            // Plate
            if (!ticket.plate.isNullOrEmpty()) {
                printerService?.printText("PLATE: ${ticket.plate}\n", null)
            }
            
            printerService?.printText("\n", null)
            
            // Fine amount (large, bold)
            printerService?.printTextWithFont("FINE: ${ticket.getFormattedAmount()}\n", null, 36, null)
            
            printerService?.printText("\n", null)
            
        } else {
            // LEGACY FORMAT (original web portal format)
            
            // Ticket serial (large, bold)
            if (ticket.serialNumber.isNotEmpty()) {
                printerService?.printTextWithFont("Ticket No: ${ticket.serialNumber}\n", null, 28, null)
                printerService?.printText("\n", null)
            }
            
            // Offence description
            if (ticket.offenceDesc.isNotEmpty()) {
                printerService?.printText("OFFENCE:\n", null)
                printerService?.printTextWithFont("${ticket.offenceDesc}\n", null, 26, null)
                printerService?.printText("\n", null)
            }
            
            // Location
            if (!ticket.location.isNullOrEmpty()) {
                printerService?.printText("LOCATION:\n", null)
                printerService?.printText("${ticket.location}\n", null)
                printerService?.printText("\n", null)
            }
            
            // Vehicle plate
            if (!ticket.plate.isNullOrEmpty()) {
                printerService?.printText("VEHICLE: ${ticket.plate}\n", null)
            }
            
            // Driver info
            if (!ticket.driverName.isNullOrEmpty()) {
                printerService?.printText("DRIVER: ${ticket.driverName}\n", null)
            }
            if (!ticket.driverLicense.isNullOrEmpty()) {
                printerService?.printText("LICENSE: ${ticket.driverLicense}\n", null)
            }
            
            // Officer badge
            if (!ticket.officerBadge.isNullOrEmpty()) {
                printerService?.printText("OFFICER: ${ticket.officerBadge}\n", null)
            }
            
            printerService?.printText("\n", null)
            
            // Fine amount (large, bold)
            printerService?.printTextWithFont("FINE AMOUNT: ${ticket.getFormattedAmount()}\n", null, 32, null)
            
            // Demerit points
            if (ticket.points > 0) {
                printerService?.printTextWithFont("DEMERIT POINTS: ${ticket.points}\n", null, 28, null)
            }
            
            // Repeat offence warning
            if (ticket.isRepeatOffence) {
                printerService?.printText("\n", null)
                printerService?.printTextWithFont("⚠️ REPEAT OFFENCE\n", null, 26, null)
            }
            
            printerService?.printText("\n", null)
            
            // Payment status
            if (ticket.courtRequired) {
                printerService?.setAlignment(1, null) // Center
                printerService?.printTextWithFont("⚖️ COURT APPEARANCE REQUIRED\n", null, 28, null)
                printerService?.printText("Online payment not available\n", null)
                printerService?.setAlignment(0, null) // Back to left
            } else if (ticket.dueDate != null) {
                printerService?.printText("Payment due by ${ticket.dueDate}\n", null)
            }
            
            printerService?.printText("\n", null)
        }
    }
    
    /**
     * Format date for display
     */
    private fun formatDate(dateStr: String): String {
        return try {
            // Try common date formats
            when {
                dateStr.contains("T") -> {
                    // ISO format: 2024-01-29T14:30:00
                    val input = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault())
                    val output = java.text.SimpleDateFormat("MMM dd, yyyy HH:mm", java.util.Locale.getDefault())
                    output.format(input.parse(dateStr) ?: java.util.Date())
                }
                dateStr.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) -> {
                    // Simple date: 2024-01-29
                    val input = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
                    val output = java.text.SimpleDateFormat("MMM dd, yyyy", java.util.Locale.getDefault())
                    output.format(input.parse(dateStr) ?: java.util.Date())
                }
                else -> dateStr
            }
        } catch (e: Exception) {
            dateStr
        }
    }
    
    /**
     * Print QR code for payment
     * 
     * QR CODE PARAMETERS:
     * - modulesize: 6-8 recommended for thermal receipts (dots per module)
     * - errorlevel: 3 (H=30%) for maximum reliability
     */
    private fun printQRCode(ticket: OffenceTicket) {
        if (ticket.qrUrl.isEmpty() || ticket.courtRequired) {
            // Skip QR code if not available or court required
            return
        }
        
        // Center alignment for QR code
        printerService?.setAlignment(1, null)
        
        printerService?.printText("SCAN TO PAY ONLINE:\n", null)
        printerService?.printText("\n", null)
        
        // Print QR code
        // modulesize: 7 (good balance of size and scannability)
        // errorlevel: 3 (H=30% error correction for reliability)
        printerService?.printQRCode(ticket.qrUrl, 7, 3, null)
        
        printerService?.printText("\n", null)
        
        // Instructions below QR
        printerService?.setAlignment(1, null)
        printerService?.printText("Scan QR to pay instantly\n", null)
        printerService?.printText("or visit payfine.example.com\n", null)
        printerService?.printText("and enter Ticket No.\n", null)
        printerService?.printText("\n", null)
    }
    
    /**
     * Print 1D barcode of serial number
     * Fallback for devices that can't scan QR codes
     */
    private fun printBarcode(ticket: OffenceTicket) {
        val serial = ticket.getSerialNumber()
        if (serial.isEmpty()) {
            return
        }
        
        // Center alignment for barcode
        printerService?.setAlignment(1, null)
        
        printerService?.printText("\n", null)
        
        // Print barcode
        // symbology: 8 (CODE128 - most versatile)
        // height: 162 (good height for scanning)
        // width: 2 (narrow bars for 58mm paper)
        // textPosition: 2 (text below barcode)
        printerService?.printBarCode(serial, 8, 162, 2, 2, null)
        
        printerService?.printText("\n", null)
    }
    
    /**
     * Print footer with contact information
     */
    private fun printFooter(ticket: OffenceTicket) {
        // Center alignment
        printerService?.setAlignment(1, null)
        
        printerService?.printText("${"-".repeat(if (paperWidth == 80) 48 else 32)}\n", null)
        printerService?.printText("\n", null)
        
        // Contact information
        printerService?.printText("For inquiries:\n", null)
        printerService?.printText("${ticket.contactEmail}\n", null)
        
        if (!ticket.contactPhone.isNullOrEmpty()) {
            printerService?.printText("${ticket.contactPhone}\n", null)
        }
        
        printerService?.printText("\n", null)
        printerService?.printText("Keep this receipt for your records\n", null)
        printerService?.printText("\n", null)
    }
    
    /**
     * Feed paper and cut
     * Feeds 3-5 lines for readability, then cuts paper
     */
    private fun feedAndCut() {
        // Feed 4 lines for spacing
        printerService?.lineWrap(4, null)
        
        // Cut paper (full cut)
        printerService?.cutPaper(null)
    }
    
    /**
     * Test print function
     * Prints a simple test receipt to verify printer works
     */
    fun printTestReceipt(context: Context) {
        if (!isServiceBound || printerService == null) {
            Toast.makeText(context, "Printer not connected", Toast.LENGTH_SHORT).show()
            return
        }
        
        try {
            printerService?.enterPrinterBuffer(true, null)
            
            printerService?.setAlignment(1, null)
            printerService?.printTextWithFont("PRINTER TEST\n", null, 32, null)
            printerService?.printText("\n", null)
            
            printerService?.setAlignment(0, null)
            printerService?.printText("Printer Model: ${printerService?.printerModal}\n", null)
            printerService?.printText("Serial No: ${printerService?.printerSerialNo}\n", null)
            printerService?.printText("Paper Width: ${paperWidth}mm\n", null)
            printerService?.printText("Status: ${getPrinterStatusText()}\n", null)
            printerService?.printText("\n", null)
            
            printerService?.setAlignment(1, null)
            printerService?.printText("Test QR Code:\n", null)
            printerService?.printQRCode("https://payfine.example.com", 7, 3, null)
            printerService?.printText("\n", null)
            
            printerService?.lineWrap(3, null)
            printerService?.cutPaper(null)
            
            printerService?.commitPrinterBuffer(object : ICallback.Stub() {
                override fun onRunResult(isSuccess: Boolean) {
                    Toast.makeText(context, if (isSuccess) "✅ Test print OK" else "❌ Test print failed", Toast.LENGTH_SHORT).show()
                }
                override fun onReturnString(data: String?) {}
                override fun onPrintResult(isSuccess: Boolean) {}
            })
            
        } catch (e: RemoteException) {
            Log.e(TAG, "Test print error", e)
            Toast.makeText(context, "Test print error: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
}

